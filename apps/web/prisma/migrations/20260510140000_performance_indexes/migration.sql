-- Performance indexes — fixes table scans on hot paths
-- Migration: 20260510140000_performance_indexes

CREATE INDEX IF NOT EXISTS "Contract_organizationId_updatedAt_idx" ON "Contract"("organizationId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Contract_docusealSubmissionId_idx" ON "Contract"("docusealSubmissionId") WHERE "docusealSubmissionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Activity_contractId_idx" ON "Activity"("contractId");
CREATE INDEX IF NOT EXISTS "ContractFile_contractId_idx" ON "ContractFile"("contractId");
CREATE INDEX IF NOT EXISTS "ContractAlert_contractId_idx" ON "ContractAlert"("contractId");
CREATE INDEX IF NOT EXISTS "Approval_contractId_idx" ON "Approval"("contractId");
CREATE INDEX IF NOT EXISTS "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");
