ALTER TABLE "user" DROP CONSTRAINT "user_agreement_link_ck";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_agreement_id_teacher_agreement_id_fk";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "agreement_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "agreement_kind";--> statement-breakpoint
DROP TYPE "public"."agreement_kind";--> statement-breakpoint
DROP TABLE "teacher_payout";--> statement-breakpoint
DROP TABLE "agreement_teacher";--> statement-breakpoint
DROP TABLE "teacher_agreement";--> statement-breakpoint
CREATE TABLE "payout_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"amount" numeric(10, 2),
	"added_by_hand" boolean DEFAULT false NOT NULL,
	CONSTRAINT "payout_line_sheet_student_uq" UNIQUE("sheet_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "payout_sheet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"class_name" varchar(255) NOT NULL,
	"month" varchar(7) NOT NULL,
	"confirmed_at" timestamp,
	CONSTRAINT "payout_sheet_academy_class_month_uq" UNIQUE("academy_id","class_name","month")
);
--> statement-breakpoint
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_sheet_id_payout_sheet_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."payout_sheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_sheet" ADD CONSTRAINT "payout_sheet_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;