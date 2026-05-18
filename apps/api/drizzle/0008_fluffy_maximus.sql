ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
UPDATE "user" SET "role" = 'owner' WHERE "role" = 'instructor';
ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM('student', 'owner');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'student';
DROP TYPE "user_role_old";
