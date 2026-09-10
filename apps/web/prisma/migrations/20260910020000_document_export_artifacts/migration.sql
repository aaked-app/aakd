BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A transaction-scoped deployment mutex makes the bounded lock timeout
-- observable and prevents two operators applying this unshipped DDL at once.
SELECT pg_advisory_xact_lock(hashtext('aakd_document_export_artifacts_migration'));

CREATE TYPE "DocumentExportArtifactState" AS ENUM ('QUEUED', 'READY', 'FAILED', 'EXPIRING', 'EXPIRED');
CREATE TYPE "DocumentExportAttemptState" AS ENUM ('UPLOADING', 'WINNER', 'CLEANUP_PENDING', 'CLEANED', 'CLEANUP_FAILED');

CREATE TABLE "DocumentExportArtifact" (
  "jobId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "requestedByMemberId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentVersion" INTEGER NOT NULL,
  "documentContentHash" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "state" "DocumentExportArtifactState" NOT NULL DEFAULT 'QUEUED',
  "storageKey" TEXT,
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "cleanedAt" TIMESTAMP(3),
  "cleanupError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentExportArtifact_pkey" PRIMARY KEY ("jobId"),
  CONSTRAINT "DocumentExportArtifact_documentVersion_check" CHECK ("documentVersion" > 0),
  CONSTRAINT "DocumentExportArtifact_documentContentHash_check" CHECK ("documentContentHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "DocumentExportArtifact_format_check" CHECK ("format" IN ('docx', 'pdf')),
  CONSTRAINT "DocumentExportArtifact_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "DocumentExportArtifact_state_storage_check" CHECK (
    ("state" = 'READY' AND "storageKey" IS NOT NULL AND "publishedAt" IS NOT NULL AND "cleanedAt" IS NULL)
    OR ("state" IN ('QUEUED', 'FAILED') AND "storageKey" IS NULL AND "publishedAt" IS NULL AND "cleanedAt" IS NULL)
    OR ("state" = 'EXPIRING' AND "storageKey" IS NOT NULL AND "publishedAt" IS NOT NULL AND "cleanedAt" IS NULL)
    OR ("state" = 'EXPIRED' AND "storageKey" IS NULL AND "cleanedAt" IS NOT NULL)
  )
);

CREATE TABLE "DocumentExportAttempt" (
  "id" TEXT NOT NULL,
  "artifactJobId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "state" "DocumentExportAttemptState" NOT NULL DEFAULT 'UPLOADING',
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "cleanupError" TEXT,
  "cleanupClaimId" TEXT,
  "cleanedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentExportAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentExportAttempt_lease_check" CHECK ("leaseExpiresAt" >= "createdAt"),
  CONSTRAINT "DocumentExportAttempt_state_cleanup_check" CHECK (
    ("state" = 'CLEANED' AND "cleanedAt" IS NOT NULL AND "cleanupError" IS NULL AND "cleanupClaimId" IS NULL)
    OR ("state" = 'CLEANUP_FAILED' AND "cleanedAt" IS NULL AND "cleanupError" IS NOT NULL AND "cleanupClaimId" IS NULL)
    OR ("state" IN ('UPLOADING', 'WINNER') AND "cleanedAt" IS NULL AND "cleanupError" IS NULL AND "cleanupClaimId" IS NULL)
    OR ("state" = 'CLEANUP_PENDING' AND "cleanedAt" IS NULL AND "cleanupError" IS NULL AND "cleanupClaimId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "DocumentExportArtifact_storageKey_key" ON "DocumentExportArtifact"("storageKey");
CREATE INDEX "DocumentExportArtifact_organizationId_contractId_requestedByMemberId_state_idx"
  ON "DocumentExportArtifact"("organizationId", "contractId", "requestedByMemberId", "state");
CREATE INDEX "DocumentExportArtifact_state_expiresAt_idx" ON "DocumentExportArtifact"("state", "expiresAt");
CREATE UNIQUE INDEX "DocumentExportAttempt_storageKey_key" ON "DocumentExportAttempt"("storageKey");
CREATE INDEX "DocumentExportAttempt_artifactJobId_state_idx" ON "DocumentExportAttempt"("artifactJobId", "state");
CREATE INDEX "DocumentExportAttempt_state_leaseExpiresAt_idx" ON "DocumentExportAttempt"("state", "leaseExpiresAt");

ALTER TABLE "DocumentExportAttempt"
  ADD CONSTRAINT "DocumentExportAttempt_artifactJobId_fkey"
  FOREIGN KEY ("artifactJobId") REFERENCES "DocumentExportArtifact"("jobId") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
