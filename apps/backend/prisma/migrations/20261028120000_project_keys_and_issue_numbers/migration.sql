-- Human-readable issue keys (e.g. WA-12): a readable Project.key, a per-project
-- issue counter, and Issue.number. Existing rows are backfilled here.

ALTER TABLE "Project" ADD COLUMN "issueCounter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Issue" ADD COLUMN "number" INTEGER;

-- Replace the old random (cuid) project keys with ones derived from the name,
-- using the same rule as `deriveProjectKey` (src/modules/projects/project-key.ts):
-- initials of up to 4 words, or the first 3 characters of a single word;
-- upper-cased, "PRJ" when nothing is left, "P"-prefixed when it starts with a
-- digit, and 2, 3, ... appended until it is unique within the workspace.
-- Oldest projects pick first, so they get the unsuffixed key.
DO $$
DECLARE
  p         RECORD;
  words     TEXT[];
  base      TEXT;
  candidate TEXT;
  n         INT;
BEGIN
  FOR p IN SELECT "id", "name", "workspaceId" FROM "Project" ORDER BY "createdAt", "id" LOOP
    words := ARRAY(
      SELECT w FROM regexp_split_to_table(p."name", '[^A-Za-z0-9]+') AS w WHERE w <> ''
    );

    IF coalesce(array_length(words, 1), 0) >= 2 THEN
      SELECT string_agg(left(t.w, 1), '' ORDER BY t.i) INTO base
      FROM unnest(words[1:4]) WITH ORDINALITY AS t(w, i);
    ELSIF coalesce(array_length(words, 1), 0) = 1 THEN
      base := left(words[1], 3);
    ELSE
      base := 'PRJ';
    END IF;

    base := upper(base);
    IF base ~ '^[0-9]' THEN
      base := 'P' || base;
    END IF;

    candidate := base;
    n := 1;
    WHILE EXISTS (
      SELECT 1 FROM "Project"
      WHERE "workspaceId" = p."workspaceId" AND "key" = candidate AND "id" <> p."id"
    ) LOOP
      n := n + 1;
      candidate := base || n;
    END LOOP;

    UPDATE "Project" SET "key" = candidate WHERE "id" = p."id";
  END LOOP;
END $$;

-- Number existing issues per project in creation order.
UPDATE "Issue" AS i
SET "number" = ranked.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id") AS rn
  FROM "Issue"
) AS ranked
WHERE i."id" = ranked."id";

UPDATE "Project" AS p
SET "issueCounter" = coalesce((SELECT max("number") FROM "Issue" WHERE "projectId" = p."id"), 0);

ALTER TABLE "Issue" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "Issue_projectId_number_key" ON "Issue"("projectId", "number");
