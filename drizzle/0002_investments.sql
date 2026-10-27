CREATE TYPE "public"."instrument_kind" AS ENUM('mutual_fund', 'stock');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('amfi', 'yahoo', 'manual');--> statement-breakpoint
CREATE TYPE "public"."trade_source" AS ENUM('manual', 'sip', 'import', 'converted');--> statement-breakpoint
CREATE TYPE "public"."trade_type" AS ENUM('buy', 'sell');--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'invest';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'redeem';--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "instrument_kind" NOT NULL,
	"name" text NOT NULL,
	"scheme_code" text,
	"symbol" text,
	"exchange" text,
	"isin" text,
	"last_price" numeric(18, 4),
	"price_date" date,
	"price_source" "price_source",
	"price_checked_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_identity_ck" CHECK (("instruments"."kind" = 'mutual_fund' and "instruments"."scheme_code" is not null)
          or ("instruments"."kind" = 'stock' and "instruments"."symbol" is not null and "instruments"."exchange" in ('NSE', 'BSE')))
);
--> statement-breakpoint
ALTER TABLE "instruments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"type" "trade_type" NOT NULL,
	"trade_date" date NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"price" numeric(18, 4) NOT NULL,
	"amount_paise" bigint NOT NULL,
	"charges_paise" bigint DEFAULT 0 NOT NULL,
	"cash_transaction_id" uuid,
	"source" "trade_source" DEFAULT 'manual' NOT NULL,
	"recurring_payment_id" uuid,
	"units_estimated" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "investment_tx_positive_ck" CHECK ("investment_transactions"."quantity" > 0 and "investment_transactions"."price" > 0 and "investment_transactions"."amount_paise" >= 0 and "investment_transactions"."charges_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "investment_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_cash_transaction_id_transactions_id_fk" FOREIGN KEY ("cash_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_recurring_payment_id_recurring_payments_id_fk" FOREIGN KEY ("recurring_payment_id") REFERENCES "public"."recurring_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_user_scheme_uq" ON "instruments" USING btree ("user_id","scheme_code");--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_user_symbol_uq" ON "instruments" USING btree ("user_id","symbol","exchange");--> statement-breakpoint
CREATE INDEX "investment_tx_user_instrument_idx" ON "investment_transactions" USING btree ("user_id","instrument_id","trade_date");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_tx_cash_uq" ON "investment_transactions" USING btree ("cash_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_tx_recurring_date_uq" ON "investment_transactions" USING btree ("recurring_payment_id","trade_date");--> statement-breakpoint
CREATE POLICY "instruments_owner_all" ON "instruments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "investment_transactions_owner_all" ON "investment_transactions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);