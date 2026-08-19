-- A title is a human-facing label, not a stable source identity. Preserve
-- distinct cited clauses that happen to have the same title.
ALTER TABLE "ContractObligationSuggestion"
  ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;

UPDATE "ContractObligationSuggestion"
  SET "sourceKey" = COALESCE("sourceText", '') || E'\\x1F' || COALESCE("clauseReference", '')
  WHERE "sourceKey" IS NULL;

ALTER TABLE "ContractObligationSuggestion"
  ALTER COLUMN "sourceKey" SET NOT NULL;

DROP INDEX IF EXISTS "ContractObligationSuggestion_contractId_sourceHash_title_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ContractObligationSuggestion_contractId_sourceHash_sourceKey_key"
  ON "ContractObligationSuggestion"("contractId", "sourceHash", "sourceKey");
