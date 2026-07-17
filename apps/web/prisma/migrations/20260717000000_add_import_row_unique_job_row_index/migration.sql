-- DropIndex
DROP INDEX "ImportRow_jobId_rowIndex_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_jobId_rowIndex_key" ON "ImportRow"("jobId", "rowIndex");
