-- Exact extraction provenance. Existing rows deliberately remain unbound;
-- there is no safe historical inference from `isLatest` alone.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "Contract"
  ADD COLUMN "extractedSourceFileId" TEXT,
  ADD COLUMN "extractedSourceFileVersion" INTEGER,
  ADD COLUMN "extractedSourceHash" TEXT,
  ADD CONSTRAINT "Contract_extracted_source_binding_complete" CHECK ((
    ("extractedSourceFileId" IS NULL AND "extractedSourceFileVersion" IS NULL AND "extractedSourceHash" IS NULL)
    OR
    (
      "extractedSourceFileId" IS NOT NULL
      AND "extractedSourceFileVersion" > 0
      AND "extractedSourceHash" ~ '^[0-9a-f]{64}$'
    )
  ) IS TRUE);

CREATE INDEX "Contract_extractedSourceFileId_idx" ON "Contract"("extractedSourceFileId");

-- Immutable provenance for actions created by the governed Agent Gateway.
ALTER TABLE "ContractAction"
  ADD COLUMN "sourceFileId" TEXT,
  ADD COLUMN "sourceFileVersion" INTEGER,
  ADD COLUMN "proposedByPrincipalType" TEXT,
  ADD COLUMN "proposedByPrincipalId" TEXT,
  ADD COLUMN "proposalDigest" TEXT,
  ADD CONSTRAINT "ContractAction_agent_provenance_complete" CHECK ((
    ("proposedByPrincipalType" IS NULL AND "proposedByPrincipalId" IS NULL AND "proposalDigest" IS NULL AND "sourceFileId" IS NULL AND "sourceFileVersion" IS NULL)
    OR
    (
      "proposedByPrincipalType" IS NOT NULL
      AND "proposedByPrincipalType" IN ('session_member', 'api_key')
      AND "proposedByPrincipalId" IS NOT NULL
      AND "proposalDigest" ~ '^[0-9a-f]{64}$'
      AND "sourceFileId" IS NOT NULL
      AND "sourceFileVersion" > 0
      AND "sourceHash" ~ '^[0-9a-f]{64}$'
    )
  ) IS TRUE);

CREATE INDEX "ContractAction_proposedByPrincipal_idx"
  ON "ContractAction"("organizationId", "proposedByPrincipalType", "proposedByPrincipalId");

-- Approval is already the durable request primitive. These fields make an
-- agent-authored request attributable and replay-safe under concurrency.
ALTER TABLE "Approval"
  ADD COLUMN "requestPrincipalType" TEXT,
  ADD COLUMN "requestPrincipalId" TEXT,
  ADD COLUMN "requestIdempotencyHash" TEXT,
  ADD COLUMN "requestDigest" TEXT,
  ADD CONSTRAINT "Approval_agent_request_provenance_complete" CHECK ((
    ("requestPrincipalType" IS NULL AND "requestPrincipalId" IS NULL AND "requestIdempotencyHash" IS NULL AND "requestDigest" IS NULL)
    OR
    (
      "requestPrincipalType" IS NOT NULL
      AND "requestPrincipalType" IN ('session_member', 'api_key')
      AND "requestPrincipalId" IS NOT NULL
      AND "requestIdempotencyHash" ~ '^[0-9a-f]{64}$'
      AND "requestDigest" ~ '^[0-9a-f]{64}$'
    )
  ) IS TRUE);

CREATE UNIQUE INDEX "Approval_agent_request_replay_key"
  ON "Approval"("contractId", "requestPrincipalType", "requestPrincipalId", "requestIdempotencyHash");

COMMIT;
