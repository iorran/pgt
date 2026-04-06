CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'rejected');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "academy_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "join_code" varchar(50);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "academy" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "academy" ADD CONSTRAINT "academy_join_code_unique" UNIQUE("join_code");