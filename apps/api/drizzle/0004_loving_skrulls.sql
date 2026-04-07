DO $$ BEGIN
  CREATE TYPE "public"."checkin_source" AS ENUM('button', 'qr');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkin_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"token" varchar(100) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "checkin_token_token_unique" UNIQUE("token")
);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN IF NOT EXISTS "address" varchar(500);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN IF NOT EXISTS "source" "checkin_source" DEFAULT 'button' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "checkin_token" ADD CONSTRAINT "checkin_token_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkin_token_token_idx" ON "checkin_token" USING btree ("token");--> statement-breakpoint
DELETE FROM "checkin" a USING "checkin" b
WHERE a.id > b.id
  AND a.class_id = b.class_id
  AND a.student_id = b.student_id
  AND DATE(a.checked_in_at) = DATE(b.checked_in_at);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_class_student_day_idx" ON "checkin" USING btree ("class_id","student_id",DATE("checked_in_at"));
