-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- Backfill: grandfather every existing account as verified, so nothing changes
-- for users who exist today (their password keeps working after a later Google
-- sign-in). Only accounts registered from now on start unverified, and a first
-- Google sign-in on one of those drops its unproven password. To also protect
-- pre-existing password-only accounts, change the WHERE to:
--   WHERE "id" IN (SELECT "userId" FROM "Auth" WHERE "provider" = 'GOOGLE')
UPDATE "User" SET "emailVerifiedAt" = "createdAt";
