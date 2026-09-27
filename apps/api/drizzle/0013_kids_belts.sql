-- Kids belts (IBJJF). Recreate the enum instead of ALTER TYPE ... ADD VALUE, which can't run inside the
-- migration transaction (same approach as 0008). Existing values keep their meaning.
ALTER TABLE "user" ALTER COLUMN "belt" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."belt" RENAME TO "belt_old";--> statement-breakpoint
CREATE TYPE "public"."belt" AS ENUM('white', 'grey-white', 'grey', 'grey-black', 'yellow-white', 'yellow', 'yellow-black', 'orange-white', 'orange', 'orange-black', 'green-white', 'green', 'green-black', 'blue', 'purple', 'brown', 'black');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "belt" TYPE "public"."belt" USING "belt"::text::"public"."belt";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "belt" SET DEFAULT 'white';--> statement-breakpoint
DROP TYPE "public"."belt_old";
