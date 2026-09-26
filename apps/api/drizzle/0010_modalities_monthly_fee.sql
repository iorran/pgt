CREATE TABLE "modality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "modality_academy_name_uq" UNIQUE("academy_id","name")
);
--> statement-breakpoint
CREATE TABLE "student_modality" (
	"student_id" uuid NOT NULL,
	"modality_id" uuid NOT NULL,
	CONSTRAINT "student_modality_student_id_modality_id_pk" PRIMARY KEY("student_id","modality_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "training_note" text;--> statement-breakpoint
ALTER TABLE "student_membership" ADD COLUMN "monthly_fee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "modality" ADD CONSTRAINT "modality_academy_id_academy_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_modality" ADD CONSTRAINT "student_modality_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_modality" ADD CONSTRAINT "student_modality_modality_id_modality_id_fk" FOREIGN KEY ("modality_id") REFERENCES "public"."modality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ADR 0002: every student keeps what they pay today as their Monthly Fee (agreed price wins over plan price).
UPDATE "student_membership" sm SET "monthly_fee" = COALESCE(sm."agreed_price", mp."price") FROM "membership_plan" mp WHERE mp."id" = sm."plan_id";--> statement-breakpoint
INSERT INTO "modality" ("academy_id", "name") SELECT a."id", m."name" FROM "academy" a CROSS JOIN (VALUES ('Jiu-Jitsu'), ('MMA'), ('Kids'), ('Funcional'), ('Feminino')) AS m("name") ON CONFLICT DO NOTHING;
