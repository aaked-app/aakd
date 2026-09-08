ALTER TABLE "ContractActionEvidence"
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'SUBMITTED';

CREATE TABLE "ContractActionEvidenceReview" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "comment" TEXT,
  "reviewedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractActionEvidenceReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractActionEvidence_actionId_reviewStatus_idx"
  ON "ContractActionEvidence"("actionId", "reviewStatus");
CREATE INDEX "ContractActionEvidenceReview_evidenceId_createdAt_idx"
  ON "ContractActionEvidenceReview"("evidenceId", "createdAt");

ALTER TABLE "ContractActionEvidenceReview"
  ADD CONSTRAINT "ContractActionEvidenceReview_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "ContractActionEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractActionEvidenceReview"
  ADD CONSTRAINT "ContractActionEvidenceReview_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
