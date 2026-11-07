-- A Waived Month belongs to the academy that granted it, so a student who moves academy starts clean.
ALTER TABLE "waived_month" DROP CONSTRAINT "waived_month_student_month_uq";--> statement-breakpoint
ALTER TABLE "waived_month" ADD COLUMN "academy_id" uuid;--> statement-breakpoint
-- Backfill: the academy of the owner who waived it, else the student's current academy.
UPDATE "waived_month" w SET "academy_id" = COALESCE(
  (SELECT o."academy_id" FROM "user" o WHERE o."id" = w."created_by"),
  (SELECT s."academy_id" FROM "user" s WHERE s."id" = w."student_id")
);--> statement-breakpoint
DELETE FROM "waived_month" WHERE "academy_id" IS NULL;--> statement-breakpoint
ALTER TABLE "waived_month" ALTER COLUMN "academy_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "waived_month" ADD CONSTRAINT "waived_month_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waived_month" ADD CONSTRAINT "waived_month_student_academy_month_uq" UNIQUE("student_id","academy_id","reference_month");
