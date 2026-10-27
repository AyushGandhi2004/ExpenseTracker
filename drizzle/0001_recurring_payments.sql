CREATE TYPE "public"."interval_unit" AS ENUM('day', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."recurrence_end" AS ENUM('never', 'on_date', 'after_count');--> statement-breakpoint
CREATE TABLE "recurring_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"category_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"interval_unit" interval_unit NOT NULL,
	"interval_count" integer NOT NULL,
	"end_type" "recurrence_end" DEFAULT 'never' NOT NULL,
	"end_date" date,
	"end_count" integer,
	"occurrences_created" integer DEFAULT 0 NOT NULL,
	"next_due_date" date,
	"is_paused" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_payments_amount_ck" CHECK ("recurring_payments"."amount_paise" > 0),
	CONSTRAINT "recurring_payments_interval_ck" CHECK ("recurring_payments"."interval_count" between 1 and 365),
	CONSTRAINT "recurring_payments_end_ck" CHECK (("recurring_payments"."end_type" = 'on_date') = ("recurring_payments"."end_date" is not null)
          and ("recurring_payments"."end_type" = 'after_count') = ("recurring_payments"."end_count" is not null)
          and ("recurring_payments"."end_count" is null or "recurring_payments"."end_count" >= 1))
);
--> statement-breakpoint
ALTER TABLE "recurring_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_payments_user_due_idx" ON "recurring_payments" USING btree ("user_id","next_due_date");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_payment_id_recurring_payments_id_fk" FOREIGN KEY ("recurring_payment_id") REFERENCES "public"."recurring_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_recurring_date_uq" ON "transactions" USING btree ("recurring_payment_id","txn_date");--> statement-breakpoint
CREATE POLICY "recurring_payments_owner_all" ON "recurring_payments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);