ALTER TABLE "academy" ADD COLUMN "timezone" varchar(64) DEFAULT 'Europe/Lisbon' NOT NULL;--> statement-breakpoint
UPDATE "user"
   SET "role" = 'owner'
 WHERE "id" IN (SELECT "owner_id" FROM "academy" WHERE "owner_id" IS NOT NULL);
