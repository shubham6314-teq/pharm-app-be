-- AlterTable
ALTER TABLE "users" ADD COLUMN "name" VARCHAR(150) NOT NULL DEFAULT '';

UPDATE "users"
SET "name" = split_part("email", '@', 1)
WHERE "name" = '';

ALTER TABLE "users" ALTER COLUMN "name" DROP DEFAULT;
