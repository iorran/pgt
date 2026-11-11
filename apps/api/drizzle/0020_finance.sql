CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"one_off" boolean DEFAULT false NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"confirmed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_payout_academy_teacher_month_uq" UNIQUE("academy_id","teacher_id","month")
);
--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "add_on_name" varchar(50) DEFAULT 'No Gi' NOT NULL;--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "add_on_price" numeric(10, 2) DEFAULT '10.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "add_on_teacher_share" numeric(10, 2) DEFAULT '5.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "recruited_share_percent" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "add_on_teacher_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "recruited_by_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_academy_month_idx" ON "expense" USING btree ("academy_id","month");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_add_on_teacher_id_user_id_fk" FOREIGN KEY ("add_on_teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_recruited_by_id_user_id_fk" FOREIGN KEY ("recruited_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;