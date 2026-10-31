CREATE TYPE "public"."recurring_kind" AS ENUM('expense', 'income', 'sip');--> statement-breakpoint
ALTER TABLE "recurring_payments" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_payments" ALTER COLUMN "payment_method_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD COLUMN "kind" "recurring_kind" DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD COLUMN "instrument_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD COLUMN "month_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_kind_ck" CHECK (("recurring_payments"."kind" = 'expense' and "recurring_payments"."category_id" is not null and "recurring_payments"."payment_method_id" is not null)
          or ("recurring_payments"."kind" = 'income' and "recurring_payments"."category_id" is not null and "recurring_payments"."account_id" is not null)
          or ("recurring_payments"."kind" = 'sip' and "recurring_payments"."instrument_id" is not null and "recurring_payments"."payment_method_id" is not null));