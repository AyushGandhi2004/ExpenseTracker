import "server-only";
import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { addDays, todayIst } from "@/lib/dates";
import { formatPrice, formatQuantity, stampDuty, unitsFor } from "@/lib/portfolio";
import {
  countOccurrencesBefore,
  dueOccurrences,
  occurrenceAt,
  type Schedule,
} from "@/lib/recurrence";
import type { RecurringInput, RecurringUpdate } from "@/lib/validators/recurring";
import { db } from "@/server/db";
import {
  accounts,
  categories,
  instruments,
  investmentTransactions,
  paymentMethods,
  recurringPayments,
  transactions,
} from "@/server/db/schema";
import { UserError } from "@/server/errors";
import { findOrCreateInstrument } from "./investments";
import { priceForTrade, savedPrice } from "./prices";
import { assertAccount, assertCategory, getPaymentMethodAccount } from "./transactions";

type Rule = typeof recurringPayments.$inferSelect;

const scheduleOf = (r: Pick<Rule, keyof Schedule>): Schedule => ({
  startDate: r.startDate,
  intervalUnit: r.intervalUnit,
  intervalCount: r.intervalCount,
  monthEnd: r.monthEnd,
  endType: r.endType,
  endDate: r.endDate,
  endCount: r.endCount,
});

/** The next date to record after `occurrencesCreated` payments, or null when finished. */
const nextDue = (s: Schedule, occurrencesCreated: number) => occurrenceAt(s, occurrencesCreated)?.date ?? null;

async function getOwned(userId: string, id: string): Promise<Rule> {
  const [rule] = await db
    .select()
    .from(recurringPayments)
    .where(and(eq(recurringPayments.id, id), eq(recurringPayments.userId, userId)));
  if (!rule) throw new UserError("Recurring payment not found.");
  return rule;
}

// ── Reading ──────────────────────────────────────────────────────────────────

export async function listRecurring(userId: string) {
  return db
    .select({
      id: recurringPayments.id,
      kind: recurringPayments.kind,
      name: recurringPayments.name,
      amountPaise: recurringPayments.amountPaise,
      startDate: recurringPayments.startDate,
      intervalUnit: recurringPayments.intervalUnit,
      intervalCount: recurringPayments.intervalCount,
      monthEnd: recurringPayments.monthEnd,
      endType: recurringPayments.endType,
      endDate: recurringPayments.endDate,
      endCount: recurringPayments.endCount,
      occurrencesCreated: recurringPayments.occurrencesCreated,
      nextDueDate: recurringPayments.nextDueDate,
      isPaused: recurringPayments.isPaused,
      note: recurringPayments.note,
      categoryId: recurringPayments.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      paymentMethodId: recurringPayments.paymentMethodId,
      paymentMethodName: paymentMethods.name,
      paymentMethodKind: paymentMethods.kind,
      accountId: accounts.id,
      accountName: accounts.name,
      instrumentId: recurringPayments.instrumentId,
      instrumentName: instruments.name,
    })
    .from(recurringPayments)
    .leftJoin(categories, eq(categories.id, recurringPayments.categoryId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, recurringPayments.paymentMethodId))
    .leftJoin(instruments, eq(instruments.id, recurringPayments.instrumentId))
    // Income credits its own account; expenses and SIPs debit their payment method's.
    .innerJoin(accounts, eq(accounts.id, sql`coalesce(${recurringPayments.accountId}, ${paymentMethods.accountId})`))
    .where(eq(recurringPayments.userId, userId))
    .orderBy(
      asc(recurringPayments.isPaused),
      sql`${recurringPayments.nextDueDate} asc nulls last`,
      asc(recurringPayments.name),
    );
}
export type RecurringRow = Awaited<ReturnType<typeof listRecurring>>[number];

/** Active payments due within the next `days` days, plus how many schedules exist at all. */
export async function listUpcoming(userId: string, days = 7, today = todayIst()) {
  const rows = await listRecurring(userId);
  const until = addDays(today, days);
  return {
    upcoming: rows.filter((r) => !r.isPaused && r.nextDueDate !== null && r.nextDueDate <= until),
    total: rows.length,
  };
}

// ── The engine ───────────────────────────────────────────────────────────────

/**
 * Records everything that has come due (date ≤ today) on this user's active schedules:
 * expenses, income credits, and SIP instalments. Safe to run any number of times,
 * concurrently: each schedule row is locked while it is advanced, and the (schedule, date)
 * unique index makes a duplicate impossible. Returns how many were recorded.
 */
export async function materializeDuePayments(userId: string, today = todayIst()): Promise<number> {
  const due = await db
    .select({ id: recurringPayments.id, kind: recurringPayments.kind })
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.userId, userId),
        eq(recurringPayments.isPaused, false),
        isNotNull(recurringPayments.nextDueDate),
        lte(recurringPayments.nextDueDate, today),
      ),
    );

  let created = 0;
  for (const { id, kind } of due) {
    created += kind === "sip" ? await materializeSip(id, today) : await materializeCash(id, today);
  }
  return created;
}

/** Expenses and income: one ledger row per due date. */
async function materializeCash(id: string, today: string): Promise<number> {
  return db.transaction(async (tx) => {
    const [rule] = await tx.select().from(recurringPayments).where(eq(recurringPayments.id, id)).for("update");
    if (!rule || rule.isPaused || !rule.nextDueDate || rule.nextDueDate > today) return 0;

    const schedule = scheduleOf(rule);
    const occurrences = dueOccurrences(schedule, rule.occurrencesCreated, today);
    if (occurrences.length === 0) return 0;

    let accountId = rule.accountId;
    if (rule.paymentMethodId) {
      const [method] = await tx
        .select({ accountId: paymentMethods.accountId })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, rule.paymentMethodId));
      accountId = method?.accountId ?? null;
    }
    if (!accountId) return 0;

    const inserted = await tx
      .insert(transactions)
      .values(
        occurrences.map((o) => ({
          userId: rule.userId,
          type: rule.kind === "income" ? ("income" as const) : ("expense" as const),
          amountPaise: rule.amountPaise,
          txnDate: o.date,
          accountId: accountId!,
          categoryId: rule.categoryId,
          paymentMethodId: rule.paymentMethodId,
          description: rule.name,
          source: "scheduled" as const,
          recurringPaymentId: rule.id,
        })),
      )
      .onConflictDoNothing({ target: [transactions.recurringPaymentId, transactions.txnDate] })
      .returning({ id: transactions.id });

    const occurrencesCreated = rule.occurrencesCreated + occurrences.length;
    await tx
      .update(recurringPayments)
      .set({ occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
      .where(eq(recurringPayments.id, rule.id));
    return inserted.length;
  });
}

/**
 * SIP instalments: a debit from the bank (`invest`) plus a buy of amount ÷ NAV units. NAVs are
 * fetched before taking the row lock. If the date's NAV isn't out yet, the latest known is used
 * and the units are marked estimated (finalised later by finalizeEstimatedUnits). With no price
 * at all the instalment stays due and is retried on the next run, so nothing is recorded wrong.
 */
async function materializeSip(id: string, today: string): Promise<number> {
  const [snapshot] = await db.select().from(recurringPayments).where(eq(recurringPayments.id, id));
  if (!snapshot?.instrumentId || !snapshot.paymentMethodId) return 0;
  const [instrument] = await db.select().from(instruments).where(eq(instruments.id, snapshot.instrumentId));
  if (!instrument) return 0;

  const prices = new Map<string, { price: bigint; estimated: boolean }>();
  for (const { date } of dueOccurrences(scheduleOf(snapshot), snapshot.occurrencesCreated, today)) {
    const found = await priceForTrade(instrument, date);
    const saved = savedPrice(instrument);
    if (found) prices.set(date, { price: found.price, estimated: found.estimated });
    else if (saved) prices.set(date, { price: saved, estimated: true });
    else break;
  }
  if (prices.size === 0) return 0;

  return db.transaction(async (tx) => {
    const [rule] = await tx.select().from(recurringPayments).where(eq(recurringPayments.id, id)).for("update");
    if (!rule || rule.isPaused || !rule.nextDueDate || rule.nextDueDate > today || !rule.paymentMethodId) return 0;
    const [method] = await tx
      .select({ accountId: paymentMethods.accountId })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, rule.paymentMethodId));
    if (!method) return 0;

    const schedule = scheduleOf(rule);
    const chargesPaise = stampDuty(rule.amountPaise);
    let advanced = 0;
    let created = 0;
    let lastPrice: { price: bigint; date: string } | null = null;
    for (const { date } of dueOccurrences(schedule, rule.occurrencesCreated, today)) {
      const nav = prices.get(date);
      const quantity = nav ? unitsFor(rule.amountPaise - chargesPaise, nav.price) : 0n;
      if (!nav || quantity <= 0n) break; // Keep instalments in order; retry from here next run.
      advanced++;
      const [cash] = await tx
        .insert(transactions)
        .values({
          userId: rule.userId,
          type: "invest",
          amountPaise: rule.amountPaise,
          txnDate: date,
          accountId: method.accountId,
          paymentMethodId: rule.paymentMethodId,
          description: rule.name,
          source: "scheduled",
          recurringPaymentId: rule.id,
        })
        .onConflictDoNothing({ target: [transactions.recurringPaymentId, transactions.txnDate] })
        .returning({ id: transactions.id });
      if (!cash) continue;
      await tx.insert(investmentTransactions).values({
        userId: rule.userId,
        instrumentId: instrument.id,
        type: "buy",
        tradeDate: date,
        quantity: formatQuantity(quantity),
        price: formatPrice(nav.price),
        amountPaise: rule.amountPaise,
        chargesPaise,
        cashTransactionId: cash.id,
        source: "sip",
        recurringPaymentId: rule.id,
        unitsEstimated: nav.estimated,
      });
      lastPrice = { price: nav.price, date };
      created++;
    }
    if (advanced === 0) return 0;

    const occurrencesCreated = rule.occurrencesCreated + advanced;
    await tx
      .update(recurringPayments)
      .set({ occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
      .where(eq(recurringPayments.id, rule.id));
    if (!instrument.lastPrice && lastPrice) {
      await tx
        .update(instruments)
        .set({ lastPrice: formatPrice(lastPrice.price), priceDate: lastPrice.date, priceSource: "amfi" })
        .where(eq(instruments.id, instrument.id));
    }
    return created;
  });
}

/** For the daily cron: every user with something due. */
export async function materializeAllDue(today = todayIst()) {
  const users = await db
    .selectDistinct({ userId: recurringPayments.userId })
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.isPaused, false),
        isNotNull(recurringPayments.nextDueDate),
        lte(recurringPayments.nextDueDate, today),
      ),
    );
  let created = 0;
  for (const { userId } of users) created += await materializeDuePayments(userId, today);
  return { users: users.length, created };
}

// ── Writing ──────────────────────────────────────────────────────────────────

/** Checks what each kind points at and returns the columns to store. */
async function resolveTargets(userId: string, input: RecurringUpdate, current?: Rule) {
  if (input.kind === "income") {
    await assertCategory(userId, input.categoryId!, "income", current?.categoryId);
    await assertAccount(userId, input.accountId!, [current?.accountId]);
    return { categoryId: input.categoryId, paymentMethodId: null, accountId: input.accountId, instrumentId: null };
  }
  await getPaymentMethodAccount(userId, input.paymentMethodId!, current?.paymentMethodId);
  if (input.kind === "expense") {
    await assertCategory(userId, input.categoryId!, "expense", current?.categoryId);
    return { categoryId: input.categoryId, paymentMethodId: input.paymentMethodId, accountId: null, instrumentId: null };
  }
  // A SIP keeps its fund for life: stop it and start another to switch funds.
  if (current?.instrumentId) {
    return { categoryId: null, paymentMethodId: input.paymentMethodId, accountId: null, instrumentId: current.instrumentId };
  }
  const instrument = input.instrument
    ? await findOrCreateInstrument(userId, input.instrument)
    : input.instrumentId
      ? (await db.select().from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.userId, userId))))[0]
      : undefined;
  if (!instrument) throw new UserError("Pick a fund.");
  if (instrument.kind !== "mutual_fund") throw new UserError("SIPs are for mutual funds.");
  return { categoryId: null, paymentMethodId: input.paymentMethodId, accountId: null, instrumentId: instrument.id };
}

const scheduleColumns = (input: RecurringUpdate) => ({
  kind: input.kind,
  name: input.name,
  amountPaise: input.amountPaise,
  startDate: input.startDate,
  intervalUnit: input.intervalUnit,
  intervalCount: input.intervalCount,
  monthEnd: input.monthEnd,
  endType: input.endType,
  endDate: input.endDate,
  endCount: input.endCount,
  note: input.note,
});

export async function createRecurring(userId: string, input: RecurringInput, today = todayIst()) {
  const targets = await resolveTargets(userId, input);
  const schedule = scheduleOf(input);
  // Declining past payments: start counting at the first date on/after today.
  const occurrencesCreated = input.recordPast ? 0 : countOccurrencesBefore(schedule, today);

  const [rule] = await db
    .insert(recurringPayments)
    .values({ ...scheduleColumns(input), ...targets, userId, occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
    .returning({ id: recurringPayments.id });

  await materializeDuePayments(userId, today);
  return rule.id;
}

/**
 * Edits apply from the next payment; recorded payments are untouched. If the schedule itself
 * changes (first date or cycle), counting restarts at the first new date on/after today.
 */
export async function updateRecurring(userId: string, id: string, input: RecurringUpdate, today = todayIst()) {
  const current = await getOwned(userId, id);
  if (input.kind !== current.kind) throw new UserError("This can't change type. Delete it and add a new one.");
  const targets = await resolveTargets(userId, input, current);

  const schedule = scheduleOf(input);
  const scheduleChanged =
    input.startDate !== current.startDate ||
    input.intervalUnit !== current.intervalUnit ||
    input.intervalCount !== current.intervalCount ||
    input.monthEnd !== current.monthEnd;
  const occurrencesCreated = scheduleChanged ? countOccurrencesBefore(schedule, today) : current.occurrencesCreated;

  await db
    .update(recurringPayments)
    .set({ ...scheduleColumns(input), ...targets, occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
    .where(and(eq(recurringPayments.id, id), eq(recurringPayments.userId, userId)));

  await materializeDuePayments(userId, today);
}

/** Pausing skips payments; resuming continues from today (missed dates are not back-filled). */
export async function setRecurringPaused(userId: string, id: string, paused: boolean, today = todayIst()) {
  const current = await getOwned(userId, id);
  const schedule = scheduleOf(current);
  const occurrencesCreated = paused
    ? current.occurrencesCreated
    : Math.max(current.occurrencesCreated, countOccurrencesBefore(schedule, today));

  await db
    .update(recurringPayments)
    .set({ isPaused: paused, occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
    .where(and(eq(recurringPayments.id, id), eq(recurringPayments.userId, userId)));

  if (!paused) await materializeDuePayments(userId, today);
}

/** Removes the schedule. Payments already recorded stay as normal transactions. */
export async function deleteRecurring(userId: string, id: string) {
  await getOwned(userId, id);
  await db.delete(recurringPayments).where(and(eq(recurringPayments.id, id), eq(recurringPayments.userId, userId)));
}
