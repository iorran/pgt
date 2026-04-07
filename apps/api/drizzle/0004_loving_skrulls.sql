CREATE TYPE "public"."checkin_source" AS ENUM('button', 'qr');--> statement-breakpoint
CREATE TABLE "checkin_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"token" varchar(100) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "checkin_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "address" varchar(500);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "source" "checkin_source" DEFAULT 'button' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checkin_token" ADD CONSTRAINT "checkin_token_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_token_token_idx" ON "checkin_token" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "checkin_class_student_day_idx" ON "checkin" USING btree ("class_id","student_id",DATE("checked_in_at"));