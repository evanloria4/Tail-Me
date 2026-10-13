-- Rename displayName -> fullName and make it required (existing users fall back to their username)
ALTER TABLE "User" RENAME COLUMN "displayName" TO "fullName";
UPDATE "User" SET "fullName" = "username" WHERE "fullName" IS NULL;
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;
