BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "Contract"
  ADD COLUMN "signatureProviderId" TEXT,
  ADD COLUMN "signingNotificationPending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "signingNotificationEvent" TEXT;

-- Historical submission IDs do not prove which DocuSeal instance owns them.
-- Leave every legacy row unbound until an operator reviews its origin.

CREATE UNIQUE INDEX "Contract_signatureProviderId_docusealSubmissionId_key"
  ON "Contract"("signatureProviderId", "docusealSubmissionId");
CREATE INDEX "Contract_signingNotificationPending_updatedAt_idx"
  ON "Contract"("signingNotificationPending", "updatedAt");

COMMIT;
