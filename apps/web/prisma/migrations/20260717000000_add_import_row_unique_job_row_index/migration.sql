-- Dedup: any env with pre-existing duplicate (jobId, rowIndex) rows — the
-- literal precondition of the bug this migration fixes — would otherwise
-- fail CREATE UNIQUE INDEX below. Keep the newest row per key.
DELETE FROM "ImportRow" a USING "ImportRow" b WHERE a."jobId"=b."jobId" AND a."rowIndex"=b."rowIndex" AND a."id"<b."id";

-- DropIndex
DROP INDEX "ImportRow_jobId_rowIndex_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_jobId_rowIndex_key" ON "ImportRow"("jobId", "rowIndex");
