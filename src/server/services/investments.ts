import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  findOversell,
  formatBps,
  formatPrice,
  formatQuantity,
  holdingFrom,
  parsePrice,
  parseQuantity,
  portfolioSummary,
  unitsFor,
  valuePaise,
  type Trade,
} from "@/lib/portfolio";
import { formatShortDay } from "@/lib/dates";
import type { Exchange } from "@/lib/price-feeds";
import type { ConvertExpenseInput, InstrumentRef, TradeInput, TradeUpdate } from "@/lib/validators/investments";
import { db } from "@/server/db";
import {
  accounts,
  categories,
  instruments,
  investmentTransactions,
  paymentMethods,
  transactions,
  type Instrument,
} from "@/server/db/schema";
import { UserError } from "@/server/errors";
import { fundLatest, priceForTrade, savedPrice, stockChart } from "./prices";
import { assertAccount, assertDateNotFuture, getPaymentMethodAccount } from "./transactions";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// ── Instruments ──────────────────────────────────────────────────────────────

async function getOwnedInstrument(userId: string, id: string, runner: Db | Tx = db): Promise<Instrument> {
  const [row] = await runner
    .select()
    .from(instruments)
    .where(and(eq(instruments.id, id), eq(instruments.userId, userId)));
  if (!row) throw new UserError("Investment not found.");
  return row;
}

/** The user's instrument for a search pick, created (with its latest price) on first use. */
export async function findOrCreateInstrument(userId: string, ref: InstrumentRef): Promise<Instrument> {
  const identity =
    ref.kind === "mutual_fund"
      ? eq(instruments.schemeCode, ref.schemeCode)
      : and(eq(instruments.symbol, ref.symbol), eq(instruments.exchange, ref.exchange));
  const find = async () => {
    const [row] = await db
      .select()
      .from(instruments)
      .where(and(eq(instruments.userId, userId), eq(instruments.kind, ref.kind), identity));
    return row;
  };
  const existing = await find();
  if (existing) return existing;

  // Prefer the source's own name/ISIN/price; fall back to what search showed.
  let name = ref.name;
  let isin: string | null = null;
  let point: { price: bigint; date: string } | null = null;
  if (ref.kind === "mutual_fund") {
    const fund = await fundLatest(ref.schemeCode);
    if (fund) ({ name, isin, latest: point } = fund);
  } else {
    const chart = await stockChart(ref.symbol, ref.exchange);
    if (chart) {
      name = chart.name ?? name;
      point = chart.quote;
    }
  }

  await db
    .insert(instruments)
    .values({
      userId,
      kind: ref.kind,
      name,
      isin,
      schemeCode: ref.kind === "mutual_fund" ? ref.schemeCode : null,
      symbol: ref.kind === "stock" ? ref.symbol : null,
      exchange: ref.kind === "stock" ? ref.exchange : null,
      ...(point && {
        lastPrice: formatPrice(point.price),
        priceDate: point.date,
        priceSource: ref.kind === "mutual_fund" ? ("amfi" as const) : ("yahoo" as const),
        priceCheckedAt: new Date(),
      }),
    })
    .onConflictDoNothing();
  const created = await find();
  if (!created) throw new UserError("Couldn't add this investment. Try again.");
  return created;
}

async function resolveInstrument(userId: string, input: { instrumentId?: string; instrument?: InstrumentRef }) {
  if (input.instrumentId) return getOwnedInstrument(userId, input.instrumentId);
  return findOrCreateInstrument(userId, input.instrument!);
}

/** A typed price, used until a feed publishes a newer one. */
export async function setManualPrice(userId: string, instrumentId: string, price: string, priceDate: string) {
  assertDateNotFuture(priceDate);
  await getOwnedInstrument(userId, instrumentId);
  await db
    .update(instruments)
    .set({ lastPrice: formatPrice(parsePrice(price)!), priceDate, priceSource: "manual", priceCheckedAt: new Date() })
    .where(and(eq(instruments.id, instrumentId), eq(instruments.userId, userId)));
}

export async function setInstrumentArchived(userId: string, instrumentId: string, archived: boolean) {
  await getOwnedInstrument(userId, instrumentId);
  await db
    .update(instruments)
    .set({ isArchived: archived })
    .where(and(eq(instruments.id, instrumentId), eq(instruments.userId, userId)));
}

// ── Trades ───────────────────────────────────────────────────────────────────

const toTrade = (t: { id?: string; type: "buy" | "sell"; tradeDate: string; quantity: string; amountPaise: number }): Trade => ({
  type: t.type,
  date: t.tradeDate,
  quantity: parseQuantity(t.quantity)!,
  amountPaise: t.amountPaise,
});

async function liveTrades(userId: string, instrumentId: string, runner: Db | Tx = db) {
  return runner
    .select()
    .from(investmentTransactions)
    .where(
      and(
        eq(investmentTransactions.userId, userId),
        eq(investmentTransactions.instrumentId, instrumentId),
        isNull(investmentTransactions.deletedAt),
      ),
    );
}

/** Throws if this set of trades ever sells more units than were held at the time. */
function assertNoOversell(trades: readonly Trade[], instrument: Pick<Instrument, "kind">) {
  const problem = findOversell(trades);
  if (!problem) return;
  const what = instrument.kind === "mutual_fund" ? "units" : "shares";
  throw new UserError(
    `That sells more ${what} than you held on ${formatShortDay(problem.date)} (${formatQuantity(problem.held)} ${what}).`,
  );
}

/** Rejects an amount that's far from units × price (catches a typo in either). */
function assertAmountMatches(t: { type: "buy" | "sell"; quantity: string; price: string; amountPaise: number; chargesPaise: number }) {
  const gross = valuePaise(parseQuantity(t.quantity)!, parsePrice(t.price)!);
  const expected = t.type === "buy" ? gross + t.chargesPaise : gross - t.chargesPaise;
  const tolerance = Math.max(100, Math.round(expected * 0.01)); // ₹1 or 1% (stamp duty, unit rounding)
  if (Math.abs(expected - t.amountPaise) > tolerance) {
    throw new UserError("The amount doesn't match units × price. Check the numbers.");
  }
}

type CashTarget = { accountId: string; paymentMethodId: string | null } | null;

/** Buys debit a payment method's account; sells credit an account; or neither. */
async function cashTarget(
  userId: string,
  type: "buy" | "sell",
  input: { paymentMethodId: string | null; accountId: string | null },
  keep?: { paymentMethodId: string | null; accountId: string | null },
): Promise<CashTarget> {
  if (type === "buy") {
    if (!input.paymentMethodId) return null;
    const accountId = await getPaymentMethodAccount(userId, input.paymentMethodId, keep?.paymentMethodId);
    return { accountId, paymentMethodId: input.paymentMethodId };
  }
  if (!input.accountId) return null;
  await assertAccount(userId, input.accountId, [keep?.accountId]);
  return { accountId: input.accountId, paymentMethodId: null };
}

const cashRow = (userId: string, type: "buy" | "sell", target: NonNullable<CashTarget>, t: TradeUpdate, name: string) => ({
  userId,
  type: type === "buy" ? ("invest" as const) : ("redeem" as const),
  amountPaise: t.amountPaise,
  txnDate: t.tradeDate,
  accountId: target.accountId,
  paymentMethodId: target.paymentMethodId,
  categoryId: null,
  description: name,
});

/**
 * Records a buy or sell. With a cash side, the matching invest/redeem ledger row is created
 * in the same DB transaction, so the bank balance and the holding never disagree.
 * Idempotent on `input.id`.
 */
export async function recordTrade(userId: string, input: TradeInput): Promise<{ id: string; instrumentId: string }> {
  assertDateNotFuture(input.tradeDate);
  const [existing] = await db
    .select({ userId: investmentTransactions.userId, instrumentId: investmentTransactions.instrumentId })
    .from(investmentTransactions)
    .where(eq(investmentTransactions.id, input.id));
  if (existing) {
    if (existing.userId !== userId) throw new UserError("Couldn't save this trade.");
    return { id: input.id, instrumentId: existing.instrumentId };
  }

  assertAmountMatches(input);
  const instrument = await resolveInstrument(userId, input);
  const target = await cashTarget(userId, input.type, input);

  await db.transaction(async (tx) => {
    // Serialise trades on this holding so two sells can't both pass the check.
    await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrument.id)).for("update");
    if (input.type === "sell") {
      const trades = (await liveTrades(userId, instrument.id, tx)).map(toTrade);
      assertNoOversell([...trades, toTrade(input)], instrument);
    }

    const [cash] = target
      ? await tx.insert(transactions).values(cashRow(userId, input.type, target, input, instrument.name)).returning({ id: transactions.id })
      : [];
    await tx.insert(investmentTransactions).values({
      id: input.id,
      userId,
      instrumentId: instrument.id,
      type: input.type,
      tradeDate: input.tradeDate,
      quantity: input.quantity,
      price: input.price,
      amountPaise: input.amountPaise,
      chargesPaise: input.chargesPaise,
      cashTransactionId: cash?.id ?? null,
      source: "manual",
      note: input.note,
    });

    const unarchive = instrument.isArchived && input.type === "buy" ? { isArchived: false } : {};
    // No price from any feed yet: the trade's own price is the best we know.
    const seedPrice =
      !instrument.lastPrice || (instrument.priceSource === "manual" && input.tradeDate > (instrument.priceDate ?? ""))
        ? { lastPrice: input.price, priceDate: input.tradeDate, priceSource: "manual" as const }
        : {};
    if (Object.keys(unarchive).length || Object.keys(seedPrice).length) {
      await tx.update(instruments).set({ ...unarchive, ...seedPrice }).where(eq(instruments.id, instrument.id));
    }
  });
  return { id: input.id, instrumentId: instrument.id };
}

async function getOwnedTrade(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)));
  if (!row) throw new UserError("Trade not found.");
  return row;
}

/** Edits a trade and keeps its cash side in step (adds, moves, or removes it). */
export async function updateTrade(userId: string, id: string, input: TradeUpdate) {
  const current = await getOwnedTrade(userId, id);
  if (current.deletedAt) throw new UserError("This trade was deleted.");
  assertDateNotFuture(input.tradeDate);
  assertAmountMatches({ ...input, type: current.type });
  const instrument = await getOwnedInstrument(userId, current.instrumentId);

  const [currentCash] = current.cashTransactionId
    ? await db.select().from(transactions).where(eq(transactions.id, current.cashTransactionId))
    : [];
  const target = await cashTarget(userId, current.type, input, {
    paymentMethodId: currentCash?.paymentMethodId ?? null,
    accountId: currentCash?.accountId ?? null,
  });

  await db.transaction(async (tx) => {
    await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrument.id)).for("update");
    const others = (await liveTrades(userId, instrument.id, tx)).filter((t) => t.id !== id).map(toTrade);
    assertNoOversell([...others, toTrade({ ...input, type: current.type })], instrument);

    let cashTransactionId = current.cashTransactionId;
    const live = currentCash && !currentCash.deletedAt ? currentCash : null;
    if (target && live) {
      await tx.update(transactions).set(cashRow(userId, current.type, target, input, instrument.name)).where(eq(transactions.id, live.id));
    } else if (target) {
      const [cash] = await tx
        .insert(transactions)
        .values(cashRow(userId, current.type, target, input, instrument.name))
        .returning({ id: transactions.id });
      cashTransactionId = cash.id;
    } else if (live) {
      // "Don't change my bank balance": the cash side goes, the trade stays.
      await tx.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, live.id));
      cashTransactionId = null;
    }

    await tx
      .update(investmentTransactions)
      .set({
        tradeDate: input.tradeDate,
        quantity: input.quantity,
        price: input.price,
        amountPaise: input.amountPaise,
        chargesPaise: input.chargesPaise,
        note: input.note,
        cashTransactionId,
        unitsEstimated: false,
      })
      .where(eq(investmentTransactions.id, id));
  });
}

/** Soft-deletes a trade and its cash side (undo with restoreTrade). */
export async function deleteTrade(userId: string, id: string) {
  const current = await getOwnedTrade(userId, id);
  const instrument = await getOwnedInstrument(userId, current.instrumentId);
  await db.transaction(async (tx) => {
    await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrument.id)).for("update");
    if (current.type === "buy") {
      const remaining = (await liveTrades(userId, instrument.id, tx)).filter((t) => t.id !== id).map(toTrade);
      if (findOversell(remaining)) throw new UserError("A later sale needs these units. Delete that sale first.");
    }
    await setTradeDeleted(tx, current, new Date());
  });
}

export async function restoreTrade(userId: string, id: string) {
  const current = await getOwnedTrade(userId, id);
  const instrument = await getOwnedInstrument(userId, current.instrumentId);
  await db.transaction(async (tx) => {
    await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrument.id)).for("update");
    const trades = (await liveTrades(userId, instrument.id, tx)).filter((t) => t.id !== id).map(toTrade);
    assertNoOversell([...trades, toTrade(current)], instrument);
    await setTradeDeleted(tx, current, null);
  });
}

async function setTradeDeleted(tx: Tx, trade: { id: string; cashTransactionId: string | null }, deletedAt: Date | null) {
  await tx.update(investmentTransactions).set({ deletedAt }).where(eq(investmentTransactions.id, trade.id));
  if (trade.cashTransactionId) {
    await tx.update(transactions).set({ deletedAt }).where(eq(transactions.id, trade.cashTransactionId));
  }
}

/**
 * SIP instalments recorded before their day's NAV was published used the latest NAV. Once the
 * real one is out, recompute their units. Returns how many were corrected. A correction that
 * would break a later sale leaves the units as they are.
 */
export async function finalizeEstimatedUnits(userId: string | null) {
  const rows = await db
    .select({ trade: investmentTransactions, instrument: instruments })
    .from(investmentTransactions)
    .innerJoin(instruments, eq(instruments.id, investmentTransactions.instrumentId))
    .where(
      and(
        eq(investmentTransactions.unitsEstimated, true),
        isNull(investmentTransactions.deletedAt),
        userId ? eq(investmentTransactions.userId, userId) : undefined,
      ),
    );

  let finalized = 0;
  for (const { trade, instrument } of rows) {
    const nav = await priceForTrade(instrument, trade.tradeDate);
    if (!nav || nav.estimated) continue;
    const quantity = formatQuantity(unitsFor(trade.amountPaise - trade.chargesPaise, nav.price));
    await db.transaction(async (tx) => {
      await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrument.id)).for("update");
      const others = (await liveTrades(trade.userId, instrument.id, tx)).filter((t) => t.id !== trade.id).map(toTrade);
      const fits = !findOversell([...others, toTrade({ ...trade, quantity })]);
      await tx
        .update(investmentTransactions)
        .set(fits ? { quantity, price: formatPrice(nav.price), unitsEstimated: false } : { unitsEstimated: false })
        .where(eq(investmentTransactions.id, trade.id));
    });
    finalized++;
  }
  return finalized;
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** A holding with exact decimals as strings, safe to hand to client components. */
export type HoldingView = {
  id: string;
  kind: "mutual_fund" | "stock";
  name: string;
  symbol: string | null;
  exchange: string | null;
  schemeCode: string | null;
  isArchived: boolean;
  quantity: string;
  averagePrice: string | null;
  lastPrice: string | null;
  priceDate: string | null;
  priceSource: "amfi" | "yahoo" | "manual" | null;
  costPaise: number;
  valuePaise: number | null;
  unrealisedPaise: number | null;
  unrealisedPct: string | null;
  unrealisedBps: number | null;
  realisedPaise: number;
  tradeCount: number;
};

function toView(inst: Instrument, trades: Trade[]): HoldingView {
  const h = holdingFrom(trades, savedPrice(inst));
  return {
    id: inst.id,
    kind: inst.kind,
    name: inst.name,
    symbol: inst.symbol,
    exchange: inst.exchange,
    schemeCode: inst.schemeCode,
    isArchived: inst.isArchived,
    quantity: formatQuantity(h.quantity),
    averagePrice: h.averagePrice !== null ? formatPrice(h.averagePrice) : null,
    lastPrice: inst.lastPrice ? formatPrice(parsePrice(inst.lastPrice)!) : null,
    priceDate: inst.priceDate,
    priceSource: inst.priceSource,
    costPaise: h.costPaise,
    valuePaise: h.valuePaise,
    unrealisedPaise: h.unrealisedPaise,
    unrealisedBps: h.unrealisedBps,
    unrealisedPct: h.unrealisedBps !== null ? formatBps(h.unrealisedBps) : null,
    realisedPaise: h.realisedPaise,
    tradeCount: trades.length,
  };
}

/** Every holding (open ones by value, then closed/archived) and the portfolio totals. */
export async function listHoldings(userId: string) {
  const [rows, trades] = await Promise.all([
    db.select().from(instruments).where(eq(instruments.userId, userId)).orderBy(asc(instruments.name)),
    db
      .select({
        instrumentId: investmentTransactions.instrumentId,
        type: investmentTransactions.type,
        tradeDate: investmentTransactions.tradeDate,
        quantity: investmentTransactions.quantity,
        amountPaise: investmentTransactions.amountPaise,
      })
      .from(investmentTransactions)
      .where(and(eq(investmentTransactions.userId, userId), isNull(investmentTransactions.deletedAt))),
  ]);

  const byInstrument = new Map<string, Trade[]>();
  for (const t of trades) {
    const list = byInstrument.get(t.instrumentId) ?? [];
    list.push(toTrade(t));
    byInstrument.set(t.instrumentId, list);
  }

  const holdings = rows.map((inst) => toView(inst, byInstrument.get(inst.id) ?? []));
  const isOpen = (h: HoldingView) => !h.isArchived && h.quantity !== "0";
  const open = holdings.filter(isOpen).sort((a, b) => (b.valuePaise ?? b.costPaise) - (a.valuePaise ?? a.costPaise));
  const closed = holdings.filter((h) => !isOpen(h) && h.tradeCount > 0);

  const summary = portfolioSummary(
    rows
      .filter((inst) => !inst.isArchived)
      .map((inst) => ({ kind: inst.kind, holding: holdingFrom(byInstrument.get(inst.id) ?? [], savedPrice(inst)) })),
  );
  const priceDates = open.map((h) => h.priceDate).filter((d): d is string => !!d).sort();
  return {
    open,
    closed,
    summary: {
      ...summary,
      unrealisedPct: summary.unrealisedBps !== null ? formatBps(summary.unrealisedBps) : null,
      /** The oldest price date among open holdings ("prices as of"). */
      pricesAsOf: priceDates[0] ?? null,
    },
  };
}
export type Holdings = Awaited<ReturnType<typeof listHoldings>>;

/** One holding with its full trade history (newest first) and where each trade's cash went. */
export async function getHolding(userId: string, instrumentId: string) {
  const inst = await getOwnedInstrument(userId, instrumentId);
  const rows = await db
    .select({
      id: investmentTransactions.id,
      type: investmentTransactions.type,
      tradeDate: investmentTransactions.tradeDate,
      quantity: investmentTransactions.quantity,
      price: investmentTransactions.price,
      amountPaise: investmentTransactions.amountPaise,
      chargesPaise: investmentTransactions.chargesPaise,
      source: investmentTransactions.source,
      unitsEstimated: investmentTransactions.unitsEstimated,
      note: investmentTransactions.note,
      cashTransactionId: investmentTransactions.cashTransactionId,
      paymentMethodId: transactions.paymentMethodId,
      paymentMethodName: paymentMethods.name,
      accountId: transactions.accountId,
      accountName: accounts.name,
    })
    .from(investmentTransactions)
    .leftJoin(
      transactions,
      and(eq(transactions.id, investmentTransactions.cashTransactionId), isNull(transactions.deletedAt)),
    )
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
    .where(
      and(
        eq(investmentTransactions.userId, userId),
        eq(investmentTransactions.instrumentId, instrumentId),
        isNull(investmentTransactions.deletedAt),
      ),
    )
    .orderBy(desc(investmentTransactions.tradeDate), desc(investmentTransactions.createdAt));

  const trades = rows.map((r) => ({
    ...r,
    quantity: formatQuantity(parseQuantity(r.quantity)!),
    price: formatPrice(parsePrice(r.price)!),
  }));
  return { holding: toView(inst, rows.map(toTrade)), trades };
}
export type HoldingDetail = Awaited<ReturnType<typeof getHolding>>;
export type TradeRow = HoldingDetail["trades"][number];

/** Cash put into and taken out of investments in a date range (for the dashboard). */
export async function investmentFlows(userId: string, from: string, to: string) {
  const [row] = await db
    .select({
      investedPaise: sql<number>`coalesce(sum(case when ${transactions.type} = 'invest' then ${transactions.amountPaise} end), 0)::bigint`.mapWith(Number),
      redeemedPaise: sql<number>`coalesce(sum(case when ${transactions.type} = 'redeem' then ${transactions.amountPaise} end), 0)::bigint`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        inArray(transactions.type, ["invest", "redeem"]),
        sql`${transactions.txnDate} between ${from} and ${to}`,
      ),
    );
  return row;
}

// ── Converting old "Investment" expenses ─────────────────────────────────────

const INVESTMENT_CATEGORY = /invest|mutual|\bsip\b|stock|share/i;

/**
 * One-off expenses filed under an investment-like category — candidates to convert. Recurring
 * expenses are left out (a SIP would have been set up as one), as are ones the user dismissed.
 */
export async function listConvertibleExpenses(userId: string) {
  const rows = await db
    .select({
      id: transactions.id,
      amountPaise: transactions.amountPaise,
      txnDate: transactions.txnDate,
      description: transactions.description,
      categoryName: categories.name,
      paymentMethodName: paymentMethods.name,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        eq(transactions.notInvestment, false),
        ne(transactions.source, "scheduled"),
        or(
          ilike(categories.name, "%invest%"),
          ilike(categories.name, "%mutual%"),
          ilike(categories.name, "%sip%"),
          ilike(categories.name, "%stock%"),
          ilike(categories.name, "%share%"),
        ),
      ),
    )
    .orderBy(desc(transactions.txnDate));
  return rows.filter((r) => INVESTMENT_CATEGORY.test(r.categoryName));
}
export type ConvertibleExpense = Awaited<ReturnType<typeof listConvertibleExpenses>>[number];

/** "Not an investment": stop offering to convert this expense (or undo that). */
export async function setNotInvestment(userId: string, transactionId: string, notInvestment: boolean) {
  const updated = await db
    .update(transactions)
    .set({ notInvestment })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId), eq(transactions.type, "expense")))
    .returning({ id: transactions.id });
  if (updated.length === 0) throw new UserError("Transaction not found.");
}

/**
 * Turns a past expense into an investment buy: the ledger row becomes `invest` (same
 * account, amount and date — the balance doesn't move; spending drops by that amount)
 * and a buy is recorded against the chosen fund or stock.
 */
export async function convertExpense(userId: string, input: ConvertExpenseInput) {
  const [expense] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, userId)));
  if (!expense || expense.deletedAt) throw new UserError("Transaction not found.");
  if (expense.type !== "expense") throw new UserError("Only expenses can be converted.");
  assertAmountMatches({ type: "buy", quantity: input.quantity, price: input.price, amountPaise: expense.amountPaise, chargesPaise: 0 });
  const instrument = await resolveInstrument(userId, input);

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(transactions)
      .set({ type: "invest", categoryId: null, description: instrument.name })
      .where(and(eq(transactions.id, expense.id), eq(transactions.type, "expense")))
      .returning({ id: transactions.id });
    if (updated.length === 0) throw new UserError("This expense was already converted.");
    await tx.insert(investmentTransactions).values({
      userId,
      instrumentId: instrument.id,
      type: "buy",
      tradeDate: expense.txnDate,
      quantity: input.quantity,
      price: input.price,
      amountPaise: expense.amountPaise,
      cashTransactionId: expense.id,
      source: "converted",
      note: expense.description,
    });
    if (!instrument.lastPrice) {
      await tx
        .update(instruments)
        .set({ lastPrice: input.price, priceDate: expense.txnDate, priceSource: "manual" })
        .where(eq(instruments.id, instrument.id));
    }
  });
  return { instrumentId: instrument.id };
}

/** Instruments for pickers (e.g. "add to an existing holding"). */
export async function listInstruments(userId: string) {
  return db
    .select({ id: instruments.id, kind: instruments.kind, name: instruments.name, symbol: instruments.symbol, exchange: instruments.exchange })
    .from(instruments)
    .where(and(eq(instruments.userId, userId), ne(instruments.isArchived, true)))
    .orderBy(asc(instruments.name));
}

export type { Exchange };
