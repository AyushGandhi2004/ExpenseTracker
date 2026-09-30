import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
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
export const transactionType = pgEnum("transaction_type", ["expense", "income", "transfer", "adjustment"]);
export const transactionSource = pgEnum("transaction_source", ["manual", "import", "ai", "scheduled"]);

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
    ...timestamps,
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.txnDate.desc()),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
    index("transactions_user_account_idx").on(t.userId, t.accountId),
    index("transactions_user_to_account_idx").on(t.userId, t.toAccountId),
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
