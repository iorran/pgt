CREATE TABLE "family" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_student_id" uuid,
	"agreed_price" numeric(10, 2),
	"price_review_needed" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "family_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"academy_id" uuid NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"months" varchar(7)[] NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_suggestion_dismissal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"phone" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_suggestion_dismissal_uq" UNIQUE("academy_id","phone")
);
--> statement-breakpoint
CREATE TABLE "waived_month" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"reference_month" varchar(7) NOT NULL,
	"reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waived_month_student_month_uq" UNIQUE("student_id","reference_month")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "student_membership" ADD COLUMN "agreed_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "family_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "family" ADD CONSTRAINT "family_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family" ADD CONSTRAINT "family_contact_student_id_user_id_fk" FOREIGN KEY ("contact_student_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_payment" ADD CONSTRAINT "family_payment_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_payment" ADD CONSTRAINT "family_payment_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_payment" ADD CONSTRAINT "family_payment_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_suggestion_dismissal" ADD CONSTRAINT "family_suggestion_dismissal_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waived_month" ADD CONSTRAINT "waived_month_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waived_month" ADD CONSTRAINT "waived_month_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_family_payment_id_family_payment_id_fk" FOREIGN KEY ("family_payment_id") REFERENCES "public"."family_payment"("id") ON DELETE no action ON UPDATE no action;