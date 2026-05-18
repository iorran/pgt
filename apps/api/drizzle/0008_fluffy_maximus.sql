ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM('student', 'owner');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "user_role" USING (CASE WHEN "role"::text = 'instructor' THEN 'owner' ELSE "role"::text END)::"user_role";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'student';
DROP TYPE "user_role_old";
