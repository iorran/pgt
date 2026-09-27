-- Seasons created from the web form stored points as { first, second, third }; approval looked them up
-- by position, so approved results got 0 points and 0 XP. Store position keys and repair those results.
UPDATE "season" SET "points_config" = jsonb_strip_nulls(jsonb_build_object(
  '1', "points_config"->'first', '2', "points_config"->'second', '3', "points_config"->'third'))
WHERE "points_config" ?| array['first', 'second', 'third'];--> statement-breakpoint
UPDATE "competition_result" cr SET "points_awarded" = COALESCE((s."points_config"->>cr."position"::text)::numeric::int, 0)
FROM "season" s
WHERE s."id" = cr."season_id" AND cr."status" = 'approved' AND cr."points_awarded" = 0;--> statement-breakpoint
UPDATE "xp_entry" x SET "xp_amount" = cr."points_awarded" * 10
FROM "competition_result" cr
WHERE x."source_type" = 'competition' AND x."source_id" = cr."id" AND x."xp_amount" = 0 AND cr."points_awarded" > 0;
