CREATE TABLE IF NOT EXISTS "ContractObligationSuggestion" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "jobId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "clauseReference" TEXT,
  "sourceText" TEXT,
  "sourcePage" INTEGER,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "suggestedDueDays" INTEGER,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractObligationSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractObligationSuggestion_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractObligationSuggestion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContractObligationSuggestion_contractId_status_idx"
  ON "ContractObligationSuggestion"("contractId", "status");
CREATE INDEX IF NOT EXISTS "ContractObligationSuggestion_organizationId_status_idx"
  ON "ContractObligationSuggestion"("organizationId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ContractObligationSuggestion_contractId_sourceHash_title_key"
  ON "ContractObligationSuggestion"("contractId", "sourceHash", "title");
