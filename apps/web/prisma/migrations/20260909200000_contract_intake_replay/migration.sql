SET lock_timeout = '5s';

ALTER TABLE "Contract"
  ADD COLUMN "intakeRequestId" TEXT,
  ADD COLUMN "intakeRequestHash" TEXT,
  ADD COLUMN "intakeRequestedByMemberId" TEXT;

CREATE UNIQUE INDEX CONCURRENTLY "Contract_organizationId_intakeRequestId_key"
  ON "Contract"("organizationId", "intakeRequestId");
