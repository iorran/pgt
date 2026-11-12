ALTER TABLE "teacher_payout" DROP CONSTRAINT "teacher_payout_academy_teacher_month_uq";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_add_on_teacher_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_recruited_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "teacher_payout" DROP CONSTRAINT "teacher_payout_teacher_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "teacher_payout" ALTER COLUMN "agreement_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "academy" DROP COLUMN "add_on_name";--> statement-breakpoint
ALTER TABLE "academy" DROP COLUMN "add_on_price";--> statement-breakpoint
ALTER TABLE "academy" DROP COLUMN "add_on_teacher_share";--> statement-breakpoint
ALTER TABLE "academy" DROP COLUMN "recruited_share_percent";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "add_on_teacher_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "recruited_by_id";--> statement-breakpoint
ALTER TABLE "teacher_payout" DROP COLUMN "teacher_id";--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_agreement_month_uq" UNIQUE("agreement_id","month");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_agreement_link_ck" CHECK (("user"."agreement_id" IS NULL) = ("user"."agreement_kind" IS NULL));