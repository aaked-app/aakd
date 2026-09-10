-- This additive migration installs the authorization schema only. Existing-row
-- mappings must pass scripts/agreement-access-preflight.ts before a reviewed
-- owner-only backfill is applied in an operator-controlled maintenance step.

SET lock_timeout = '5s';

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_id_organizationId_key" UNIQUE ("id", "organizationId");
ALTER TABLE "Member" ADD CONSTRAINT "Member_id_organizationId_key" UNIQUE ("id", "organizationId");

CREATE TABLE "ContractAccessGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAccessGrant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TeamBrief" ADD COLUMN "audienceMemberId" TEXT;

CREATE UNIQUE INDEX CONCURRENTLY "ContractAccessGrant_contractId_memberId_key"
  ON "ContractAccessGrant"("contractId", "memberId");
CREATE INDEX CONCURRENTLY "ContractAccessGrant_organizationId_memberId_contractId_idx"
  ON "ContractAccessGrant"("organizationId", "memberId", "contractId");
CREATE INDEX CONCURRENTLY "TeamBrief_audienceMemberId_createdAt_idx"
  ON "TeamBrief"("audienceMemberId", "createdAt");

ALTER TABLE "ContractAccessGrant" ADD CONSTRAINT "ContractAccessGrant_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "ContractAccessGrant" ADD CONSTRAINT "ContractAccessGrant_contractId_organizationId_fkey"
  FOREIGN KEY ("contractId", "organizationId") REFERENCES "Contract"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "ContractAccessGrant" ADD CONSTRAINT "ContractAccessGrant_memberId_organizationId_fkey"
  FOREIGN KEY ("memberId", "organizationId") REFERENCES "Member"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "ContractAccessGrant" ADD CONSTRAINT "ContractAccessGrant_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "TeamBrief" ADD CONSTRAINT "TeamBrief_audienceMemberId_fkey"
  FOREIGN KEY ("audienceMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "ContractAccessGrant" VALIDATE CONSTRAINT "ContractAccessGrant_organizationId_fkey";
ALTER TABLE "ContractAccessGrant" VALIDATE CONSTRAINT "ContractAccessGrant_contractId_organizationId_fkey";
ALTER TABLE "ContractAccessGrant" VALIDATE CONSTRAINT "ContractAccessGrant_memberId_organizationId_fkey";
ALTER TABLE "ContractAccessGrant" VALIDATE CONSTRAINT "ContractAccessGrant_grantedById_fkey";
ALTER TABLE "TeamBrief" VALIDATE CONSTRAINT "TeamBrief_audienceMemberId_fkey";

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACCESS_GRANTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACCESS_REVOKED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TEAM_BRIEF_PUBLISHED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TEAM_BRIEF_ACKNOWLEDGED';
