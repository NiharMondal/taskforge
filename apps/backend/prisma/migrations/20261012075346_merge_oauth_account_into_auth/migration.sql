-- Merge OAuthAccount into Auth and move the email onto User.
--
-- Before: Auth held the email (+ password for email sign-ups), OAuthAccount held
-- Google links, so a Google user's identity was split across two tables.
-- After:  User.email is the one email; Auth has one row per sign-in method
-- (EMAIL with a password hash, GOOGLE with the Google `sub`).
--
-- Hand-written (Prisma's generated diff drops the data instead of moving it).

-- 1. Every user needs an email, and Auth is the only place it exists today.
--    A user with no Auth row (a Google user from before sign-up always wrote
--    one) cannot be backfilled, so stop rather than invent an address.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User" u
    WHERE NOT EXISTS (SELECT 1 FROM "Auth" a WHERE a."userId" = u."id")
  ) THEN
    RAISE EXCEPTION 'Some users have no Auth row, so their email is unknown. Give each one an Auth row (email) before running this migration.';
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN "email" TEXT;

UPDATE "User" u
SET "email" = a."email"
FROM "Auth" a
WHERE a."userId" = u."id";

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- 2. Existing Auth rows become EMAIL rows. A row without a password was only
--    ever an email holder for a Google user, not a sign-in method, so drop it.
DROP INDEX "Auth_email_key";
DROP INDEX "Auth_userId_key";

ALTER TABLE "Auth"
  DROP COLUMN "email",
  ADD COLUMN "provider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "providerId" TEXT;

DELETE FROM "Auth" WHERE "password" IS NULL;

ALTER TABLE "Auth" ALTER COLUMN "provider" DROP DEFAULT;

-- 3. Each OAuthAccount becomes a provider Auth row for the same user.
INSERT INTO "Auth" ("id", "provider", "providerId", "userId", "createdAt", "updatedAt")
SELECT "id", "provider", "providerId", "userId", "createdAt", "createdAt"
FROM "OAuthAccount";

ALTER TABLE "OAuthAccount" DROP CONSTRAINT "OAuthAccount_userId_fkey";
DROP TABLE "OAuthAccount";

CREATE UNIQUE INDEX "Auth_provider_providerId_key" ON "Auth"("provider", "providerId");
CREATE UNIQUE INDEX "Auth_userId_provider_key" ON "Auth"("userId", "provider");
