-- An issue planned into a sprint is committed work: the BACKLOG status now
-- becomes TODO when an issue joins a sprint (IssueService `committedStatus`),
-- and the board, which shows the active sprint, has no BACKLOG lane. Bring
-- existing sprint issues in line so none sit in a sprint invisible.
--
-- Their rank was a key in the BACKLOG lane and could collide with keys in the
-- TODO lane, so it is cleared: un-ranked cards sort last, and
-- `pnpm run backfill:issue-rank` assigns fresh keys.
UPDATE "Issue"
SET "status" = 'TODO', "rank" = NULL
WHERE "sprintId" IS NOT NULL
  AND "status" = 'BACKLOG';
