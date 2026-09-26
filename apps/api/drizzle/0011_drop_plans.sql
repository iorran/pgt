ALTER TABLE "membership_plan" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "membership_plan" CASCADE;--> statement-breakpoint
ALTER TABLE "student_membership" DROP CONSTRAINT IF EXISTS "student_membership_plan_id_membership_plan_id_fk";
--> statement-breakpoint
ALTER TABLE "student_membership" ALTER COLUMN "monthly_fee" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "student_membership" DROP COLUMN "plan_id";--> statement-breakpoint
ALTER TABLE "student_membership" DROP COLUMN "agreed_price";--> statement-breakpoint
DROP TYPE "public"."plan_frequency";