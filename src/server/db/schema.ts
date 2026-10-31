import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

/*
 * Conventions
 * - Money is integer paise (₹1 = 100). Never floats.
 * - Balances are derived from `transactions` (a ledger); nothing stores a mutable balance.
 * - Every row has `user_id` + RLS so the Supabase Data API (and a future mobile app) only sees its owner's data.
 *   The Next.js server connects as `postgres` through the pooler and filters by user_id itself.
 * - Soft delete via `deleted_at`; archive (hide from pickers) via `is_archived`.
 */

// `credit_card` and `wallet` are reserved for Phase 2; the UI doesn't offer them yet.
export const accountType = pgEnum("account_type", ["bank", "cash", "credit_card", "wallet"]);
export const paymentMethodKind = pgEnum("payment_method_kind", [
  "upi",
  "debit_card",
  "net_banking",
  "cash",
  "credit_card",
  "wallet",
]);
export const categoryKind = pgEnum("category_kind", ["expense", "income"]);
// invest = cash moved into a holding (not spending); redeem = cash back from a sale.
export const transactionType = pgEnum("transaction_type", [
  "expense",
  "income",
  "transfer",
  "adjustment",
  "invest",
  "redeem",
]);
export const instrumentKind = pgEnum("instrument_kind", ["mutual_fund", "stock"]);
export const priceSource = pgEnum("price_source", ["amfi", "yahoo", "manual"]);
export const tradeType = pgEnum("trade_type", ["buy", "sell"]);
export const tradeSource = pgEnum("trade_source", ["manual", "sip", "import", "converted"]);
export const transactionSource = pgEnum("transaction_source", ["manual", "import", "ai", "scheduled"]);
export const intervalUnit = pgEnum("interval_unit", ["day", "month", "year"]);
export const recurrenceEnd = pgEnum("recurrence_end", ["never", "on_date", "after_count"]);
export const recurringKind = pgEnum("recurring_kind", ["expense", "income", "sip"]);

// Number mode is safe up to 2^53 paise (~₹90 trillion).
const money = () => bigint({ mode: "number" });

const ownerId = () =>
  uuid()
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const ownerPolicy = (table: string) =>
  pgPolicy(`${table}_owner_all`, {
    for: "all",
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  });

export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    type: accountType().notNull(),
    openingBalancePaise: money().notNull().default(0),
    openingDate: date({ mode: "string" }).notNull(),
    currency: text().notNull().default("INR"),
    isArchived: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("accounts_user_name_uq").on(t.userId, sql`lower(${t.name})`),
    ownerPolicy("accounts"),
  ],
).enableRLS();

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    kind: paymentMethodKind().notNull(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    icon: text(),
    isArchived: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("payment_methods_user_name_uq").on(t.userId, sql`lower(${t.name})`),
    ownerPolicy("payment_methods"),
  ],
).enableRLS();

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    kind: categoryKind().notNull(),
    icon: text(),
    color: text(),
    parentId: uuid(),
    isArchived: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete("restrict"),
    uniqueIndex("categories_user_kind_name_uq").on(t.userId, t.kind, sql`lower(${t.name})`),
    ownerPolicy("categories"),
  ],
).enableRLS();

/**
 * A fixed cost paid on a cycle (insurance yearly, Wi-Fi every 3 months…). Each due payment is
 * materialised as a normal expense transaction (source 'scheduled') linked back here.
 * Dates are computed from `start_date` + n × interval, so month ends never drift.
 */
export const recurringPayments = pgTable(
  "recurring_payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    amountPaise: money().notNull(),
    // expense: category + payment method. income: category + account. sip: instrument + payment method.
    kind: recurringKind().notNull().default("expense"),
    categoryId: uuid().references(() => categories.id, { onDelete: "restrict" }),
    paymentMethodId: uuid().references(() => paymentMethods.id, { onDelete: "restrict" }),
    accountId: uuid().references(() => accounts.id, { onDelete: "restrict" }),
    instrumentId: uuid().references(() => instruments.id, { onDelete: "restrict" }),
    // First deduction (IST calendar day).
    startDate: date({ mode: "string" }).notNull(),
    intervalUnit: intervalUnit().notNull(),
    intervalCount: integer().notNull(),
    // Monthly cycles only: always the last day of the month (salary on 30 Nov, 31 Dec…).
    monthEnd: boolean().notNull().default(false),
    endType: recurrenceEnd().notNull().default("never"),
    endDate: date({ mode: "string" }),
    endCount: integer(),
    // How many occurrences (from the start) are already recorded or deliberately skipped.
    occurrencesCreated: integer().notNull().default(0),
    // Next payment to record; null once the schedule has ended.
    nextDueDate: date({ mode: "string" }),
    isPaused: boolean().notNull().default(false),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index("recurring_payments_user_due_idx").on(t.userId, t.nextDueDate),
    check("recurring_payments_amount_ck", sql`${t.amountPaise} > 0`),
    check("recurring_payments_interval_ck", sql`${t.intervalCount} between 1 and 365`),
    check(
      "recurring_payments_end_ck",
      sql`(${t.endType} = 'on_date') = (${t.endDate} is not null)
          and (${t.endType} = 'after_count') = (${t.endCount} is not null)
          and (${t.endCount} is null or ${t.endCount} >= 1)`,
    ),
    check(
      "recurring_payments_kind_ck",
      sql`(${t.kind} = 'expense' and ${t.categoryId} is not null and ${t.paymentMethodId} is not null)
          or (${t.kind} = 'income' and ${t.categoryId} is not null and ${t.accountId} is not null)
          or (${t.kind} = 'sip' and ${t.instrumentId} is not null and ${t.paymentMethodId} is not null)`,
    ),
    ownerPolicy("recurring_payments"),
  ],
).enableRLS();

export const transactions = pgTable(
  "transactions",
  {
    // Client-generated UUIDs are accepted so offline retries are idempotent.
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    type: transactionType().notNull(),
    // Positive for expense/income/transfer. Signed for adjustment (+ adds to balance, − removes).
    amountPaise: money().notNull(),
    // Calendar day in IST.
    txnDate: date({ mode: "string" }).notNull(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    toAccountId: uuid().references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: uuid().references(() => categories.id, { onDelete: "restrict" }),
    paymentMethodId: uuid().references(() => paymentMethods.id, { onDelete: "restrict" }),
    description: text(),
    source: transactionSource().notNull().default("manual"),
    recurringPaymentId: uuid().references(() => recurringPayments.id, { onDelete: "set null" }),
    // The user said this expense isn't an investment: don't offer to convert it.
    notInvestment: boolean().notNull().default(false),
    ...timestamps,
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.txnDate.desc()),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
    index("transactions_user_account_idx").on(t.userId, t.accountId),
    index("transactions_user_to_account_idx").on(t.userId, t.toAccountId),
    // One payment per due date per schedule — even soft-deleted rows keep their slot,
    // so a payment the user deleted is never re-created.
    uniqueIndex("transactions_recurring_date_uq").on(t.recurringPaymentId, t.txnDate),
    check(
      "transactions_amount_ck",
      sql`(${t.type} = 'adjustment' and ${t.amountPaise} <> 0) or ${t.amountPaise} > 0`,
    ),
    check(
      "transactions_transfer_ck",
      sql`(${t.type} = 'transfer') = (${t.toAccountId} is not null)
          and (${t.toAccountId} is null or ${t.toAccountId} <> ${t.accountId})`,
    ),
    check(
      "transactions_category_ck",
      sql`${t.type} not in ('expense', 'income') or ${t.categoryId} is not null`,
    ),
    ownerPolicy("transactions"),
  ],
).enableRLS();

export type Account = typeof accounts.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RecurringPayment = typeof recurringPayments.$inferSelect;

/** A mutual fund scheme or a listed stock the user holds or has held. */
export const instruments = pgTable(
  "instruments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: instrumentKind().notNull(),
    name: text().notNull(),
    // Mutual funds: AMFI scheme code. Stocks: symbol without suffix + exchange.
    schemeCode: text(),
    symbol: text(),
    exchange: text(),
    isin: text(),
    // ₹ per unit, exact decimal (string in JS).
    lastPrice: numeric({ precision: 18, scale: 4 }),
    priceDate: date({ mode: "string" }),
    priceSource: priceSource(),
    priceCheckedAt: timestamp({ withTimezone: true }),
    isArchived: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("instruments_user_scheme_uq").on(t.userId, t.schemeCode),
    uniqueIndex("instruments_user_symbol_uq").on(t.userId, t.symbol, t.exchange),
    check(
      "instruments_identity_ck",
      sql`(${t.kind} = 'mutual_fund' and ${t.schemeCode} is not null)
          or (${t.kind} = 'stock' and ${t.symbol} is not null and ${t.exchange} in ('NSE', 'BSE'))`,
    ),
    ownerPolicy("instruments"),
  ],
).enableRLS();

/**
 * A buy or sell of an instrument. The cash side, when it touched a bank account, is a
 * normal ledger row (type invest/redeem) linked by cash_transaction_id.
 */
export const investmentTransactions = pgTable(
  "investment_transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    instrumentId: uuid()
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    type: tradeType().notNull(),
    tradeDate: date({ mode: "string" }).notNull(),
    // Units (exact decimal string) and ₹ per unit.
    quantity: numeric({ precision: 24, scale: 6 }).notNull(),
    price: numeric({ precision: 18, scale: 4 }).notNull(),
    // Cash that moved: buy = paid incl. charges; sell = received after charges.
    amountPaise: money().notNull(),
    chargesPaise: money().notNull().default(0),
    cashTransactionId: uuid().references(() => transactions.id, { onDelete: "set null" }),
    source: tradeSource().notNull().default("manual"),
    recurringPaymentId: uuid().references(() => recurringPayments.id, { onDelete: "set null" }),
    // Units computed from an estimated NAV (finalised once the day's NAV is published).
    unitsEstimated: boolean().notNull().default(false),
    note: text(),
    ...timestamps,
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("investment_tx_user_instrument_idx").on(t.userId, t.instrumentId, t.tradeDate),
    uniqueIndex("investment_tx_cash_uq").on(t.cashTransactionId),
    uniqueIndex("investment_tx_recurring_date_uq").on(t.recurringPaymentId, t.tradeDate),
    check("investment_tx_positive_ck", sql`${t.quantity} > 0 and ${t.price} > 0 and ${t.amountPaise} >= 0 and ${t.chargesPaise} >= 0`),
    ownerPolicy("investment_transactions"),
  ],
).enableRLS();

/** A monthly spending limit: for one expense category, or (category null) for all spending. */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    categoryId: uuid().references(() => categories.id, { onDelete: "cascade" }),
    amountPaise: money().notNull(),
    ...timestamps,
  },
  (t) => [
    // One per category, and one overall (nulls would otherwise count as distinct).
    uniqueIndex("budgets_user_category_uq").on(t.userId, sql`coalesce(${t.categoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`),
    check("budgets_amount_ck", sql`${t.amountPaise} > 0`),
    ownerPolicy("budgets"),
  ],
).enableRLS();

export type Instrument = typeof instruments.$inferSelect;
export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;
