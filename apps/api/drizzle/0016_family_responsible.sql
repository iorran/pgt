-- ADR 0004: one login per Family. New role `responsible` (logs in only to manage a Family).
-- Recreate the enum instead of ALTER TYPE ... ADD VALUE, which can't run inside the migration
-- transaction (same approach as 0008 and 0013).
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."user_role" RENAME TO "user_role_old";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'owner', 'responsible');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role" USING "role"::text::"public"."user_role";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'student';--> statement-breakpoint
DROP TYPE "public"."user_role_old";--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "responsible_user_id" uuid;--> statement-breakpoint
ALTER TABLE "family" ADD CONSTRAINT "family_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill active families: the Family Contact if still a member, otherwise the oldest member
-- (birth date, then join date). Families without members stay without a Responsible.
UPDATE "family" f SET "responsible_user_id" = pick.user_id
FROM (
  SELECT DISTINCT ON (u."family_id") u."family_id", u."id" AS user_id
  FROM "user" u
  JOIN "family" fam ON fam."id" = u."family_id"
  ORDER BY u."family_id", (u."id" = fam."contact_student_id") DESC, u."date_of_birth" ASC NULLS LAST, u."created_at" ASC
) pick
WHERE pick."family_id" = f."id" AND f."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "family_responsible_active_uq" ON "family" USING btree ("responsible_user_id") WHERE "family"."deleted_at" is null;
