CREATE TYPE "public"."agreement_kind" AS ENUM('addOn', 'recruited');--> statement-breakpoint
CREATE TABLE "agreement_teacher" (
	"agreement_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	CONSTRAINT "agreement_teacher_agreement_id_teacher_id_pk" PRIMARY KEY("agreement_id","teacher_id")
);
--> statement-breakpoint
CREATE TABLE "teacher_agreement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"share_percent" integer NOT NULL,
	"add_on_price" numeric(10, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "agreement_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "agreement_kind" "agreement_kind";--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD COLUMN "agreement_id" uuid;--> statement-breakpoint
ALTER TABLE "agreement_teacher" ADD CONSTRAINT "agreement_teacher_agreement_id_teacher_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."teacher_agreement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_teacher" ADD CONSTRAINT "agreement_teacher_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_agreement" ADD CONSTRAINT "teacher_agreement_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_agreement_id_teacher_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."teacher_agreement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_agreement_id_teacher_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."teacher_agreement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Data: each academy with marked Students or confirmed payouts gets one agreement from its old settings.
INSERT INTO "teacher_agreement" ("academy_id", "name", "share_percent", "add_on_price")
SELECT a."id", a."add_on_name", a."recruited_share_percent", a."add_on_price"
FROM "academy" a
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u."academy_id" = a."id" AND (u."add_on_teacher_id" IS NOT NULL OR u."recruited_by_id" IS NOT NULL))
   OR EXISTS (SELECT 1 FROM "teacher_payout" p WHERE p."academy_id" = a."id");--> statement-breakpoint
INSERT INTO "agreement_teacher" ("agreement_id", "teacher_id")
SELECT DISTINCT ta."id", t."teacher_id"
FROM "teacher_agreement" ta
JOIN (
  SELECT "academy_id", "add_on_teacher_id" AS "teacher_id" FROM "user" WHERE "add_on_teacher_id" IS NOT NULL
  UNION SELECT "academy_id", "recruited_by_id" FROM "user" WHERE "recruited_by_id" IS NOT NULL
  UNION SELECT "academy_id", "teacher_id" FROM "teacher_payout"
) t ON t."academy_id" = ta."academy_id";--> statement-breakpoint
UPDATE "user" u
SET "agreement_id" = ta."id",
    "agreement_kind" = CASE WHEN u."recruited_by_id" IS NOT NULL THEN 'recruited'::"agreement_kind" ELSE 'addOn'::"agreement_kind" END
FROM "teacher_agreement" ta
WHERE ta."academy_id" = u."academy_id" AND (u."add_on_teacher_id" IS NOT NULL OR u."recruited_by_id" IS NOT NULL);--> statement-breakpoint
UPDATE "teacher_payout" p SET "agreement_id" = ta."id" FROM "teacher_agreement" ta WHERE ta."academy_id" = p."academy_id";--> statement-breakpoint
-- Several old per-teacher payouts of a month become one per agreement: keep the earliest row with the sum.
UPDATE "teacher_payout" p
SET "amount" = s."total"
FROM (SELECT "agreement_id", "month", SUM("amount") AS "total", MIN("id"::text) AS "keep" FROM "teacher_payout" GROUP BY "agreement_id", "month") s
WHERE p."agreement_id" = s."agreement_id" AND p."month" = s."month" AND p."id"::text = s."keep";--> statement-breakpoint
DELETE FROM "teacher_payout" p
USING (SELECT "agreement_id", "month", MIN("id"::text) AS "keep" FROM "teacher_payout" GROUP BY "agreement_id", "month") s
WHERE p."agreement_id" = s."agreement_id" AND p."month" = s."month" AND p."id"::text <> s."keep";
