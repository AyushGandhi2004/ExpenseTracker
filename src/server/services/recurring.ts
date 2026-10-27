import "server-only";
import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { addDays, todayIst } from "@/lib/dates";
import {
  countOccurrencesBefore,
  dueOccurrences,
  occurrenceAt,
  type Schedule,
} from "@/lib/recurrence";
import type { RecurringInput, RecurringUpdate } from "@/lib/validators/recurring";
import { db } from "@/server/db";
import { accounts, categories, paymentMethods, recurringPayments, transactions } from "@/server/db/schema";
import { UserError } from "@/server/errors";
import { assertCategory, getPaymentMethodAccount } from "./transactions";

type Rule = typeof recurringPayments.$inferSelect;

const scheduleOf = (r: Pick<Rule, keyof Schedule>): Schedule => ({
  startDate: r.startDate,
  intervalUnit: r.intervalUnit,
  intervalCount: r.intervalCount,
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
      name: recurringPayments.name,
      amountPaise: recurringPayments.amountPaise,
      startDate: recurringPayments.startDate,
      intervalUnit: recurringPayments.intervalUnit,
      intervalCount: recurringPayments.intervalCount,
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
      accountName: accounts.name,
    })
    .from(recurringPayments)
    .innerJoin(categories, eq(categories.id, recurringPayments.categoryId))
    .innerJoin(paymentMethods, eq(paymentMethods.id, recurringPayments.paymentMethodId))
    .innerJoin(accounts, eq(accounts.id, paymentMethods.accountId))
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
 * Records every payment that has come due (date ≤ today) for this user's active schedules.
 * Safe to run any number of times, concurrently: each schedule row is locked while it is
 * advanced, and the (schedule, date) unique index makes a duplicate payment impossible.
 * Returns how many payments were recorded.
 */
export async function materializeDuePayments(userId: string, today = todayIst()): Promise<number> {
  const due = await db
    .select({ id: recurringPayments.id })
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
  for (const { id } of due) {
    created += await db.transaction(async (tx) => {
      const [rule] = await tx.select().from(recurringPayments).where(eq(recurringPayments.id, id)).for("update");
      if (!rule || rule.isPaused || !rule.nextDueDate || rule.nextDueDate > today) return 0;

      const schedule = scheduleOf(rule);
      const occurrences = dueOccurrences(schedule, rule.occurrencesCreated, today);
      if (occurrences.length === 0) return 0;

      const [method] = await tx
        .select({ accountId: paymentMethods.accountId })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, rule.paymentMethodId));
      if (!method) return 0;

      const inserted = await tx
        .insert(transactions)
        .values(
          occurrences.map((o) => ({
            userId: rule.userId,
            type: "expense" as const,
            amountPaise: rule.amountPaise,
            txnDate: o.date,
            accountId: method.accountId,
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
  return created;
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

export async function createRecurring(userId: string, input: RecurringInput, today = todayIst()) {
  await assertCategory(userId, input.categoryId, "expense");
  await getPaymentMethodAccount(userId, input.paymentMethodId);

  const { recordPast, ...fields } = input;
  const schedule = scheduleOf(fields);
  // Declining past payments: start counting at the first date on/after today.
  const occurrencesCreated = recordPast ? 0 : countOccurrencesBefore(schedule, today);

  const [rule] = await db
    .insert(recurringPayments)
    .values({ ...fields, userId, occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
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
  await assertCategory(userId, input.categoryId, "expense", current.categoryId);
  await getPaymentMethodAccount(userId, input.paymentMethodId, current.paymentMethodId);

  const schedule = scheduleOf(input);
  const scheduleChanged =
    input.startDate !== current.startDate ||
    input.intervalUnit !== current.intervalUnit ||
    input.intervalCount !== current.intervalCount;
  const occurrencesCreated = scheduleChanged ? countOccurrencesBefore(schedule, today) : current.occurrencesCreated;

  await db
    .update(recurringPayments)
    .set({ ...input, occurrencesCreated, nextDueDate: nextDue(schedule, occurrencesCreated) })
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
