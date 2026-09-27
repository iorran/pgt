ALTER TABLE "competition_result" ADD COLUMN "points_overridden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Position-less entries (Carried-over Points) were typed by the owner.
UPDATE "competition_result" SET "points_overridden" = true WHERE "position" IS NULL;
