-- Add risk scoring and OCR extraction fields to Contract.
-- These were added to schema.prisma but never had a migration file.
ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "isOcrExtracted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "riskScore"      TEXT,
  ADD COLUMN IF NOT EXISTS "riskScoredAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "riskDetails"    JSONB;

-- Indexes for risk/OCR filtering queries
CREATE INDEX IF NOT EXISTS "Contract_organizationId_autoRenewal_endDate_idx"
  ON "Contract"("organizationId", "autoRenewal", "endDate");

CREATE INDEX IF NOT EXISTS "Contract_organizationId_riskScore_idx"
  ON "Contract"("organizationId", "riskScore");

CREATE INDEX IF NOT EXISTS "Contract_organizationId_isOcrExtracted_idx"
  ON "Contract"("organizationId", "isOcrExtracted");
