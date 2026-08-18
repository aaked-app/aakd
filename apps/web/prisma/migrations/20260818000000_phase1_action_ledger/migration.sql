-- Phase 1 action ledger is additive. Existing obligations and alerts remain
-- intact and can be projected idempotently into ContractAction.

CREATE TYPE "ContractActionKind" AS ENUM ('OBLIGATION', 'RENEWAL_NOTICE', 'EXPIRY', 'CUSTOM');
CREATE TYPE "ContractActionStatus" AS ENUM ('PROPOSED', 'PENDING_REVIEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'STALE', 'DISMISSED');

CREATE TABLE "ContractAction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "sourceObligationId" TEXT,
  "sourceAlertId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "kind" "ContractActionKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "condition" TEXT,
  "dueDate" TIMESTAMP(3),
  "noticeDate" TIMESTAMP(3),
  "assigneeId" TEXT,
  "sourceText" TEXT,
  "sourcePage" INTEGER,
  "confidence" DOUBLE PRECISION,
  "sourceHash" TEXT,
  "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  "status" "ContractActionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "evidenceRequired" TEXT,
  "escalationState" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "staleAt" TIMESTAMP(3),
  "createdById" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractAction_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractAction_sourceObligationId_fkey" FOREIGN KEY ("sourceObligationId") REFERENCES "ContractObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContractAction_sourceAlertId_fkey" FOREIGN KEY ("sourceAlertId") REFERENCES "ContractAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContractAction_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContractAction_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContractAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ContractAction_organizationId_sourceKey_key" ON "ContractAction"("organizationId", "sourceKey");
CREATE INDEX "ContractAction_organizationId_status_dueDate_idx" ON "ContractAction"("organizationId", "status", "dueDate");
CREATE INDEX "ContractAction_organizationId_assigneeId_status_idx" ON "ContractAction"("organizationId", "assigneeId", "status");
CREATE INDEX "ContractAction_contractId_kind_idx" ON "ContractAction"("contractId", "kind");
CREATE INDEX "ContractAction_sourceObligationId_idx" ON "ContractAction"("sourceObligationId");
CREATE INDEX "ContractAction_sourceAlertId_idx" ON "ContractAction"("sourceAlertId");

CREATE TABLE "ContractActionEvidence" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "note" TEXT,
  "storageKey" TEXT,
  "sourceUrl" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractActionEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractActionEvidence_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ContractAction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractActionEvidence_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON UPDATE CASCADE
);
CREATE INDEX "ContractActionEvidence_actionId_createdAt_idx" ON "ContractActionEvidence"("actionId", "createdAt");

CREATE TABLE "ContractActionDelivery" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "externalRef" TEXT,
  "errorCode" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractActionDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractActionDelivery_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ContractAction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContractActionDelivery_idempotencyKey_key" ON "ContractActionDelivery"("idempotencyKey");
CREATE INDEX "ContractActionDelivery_actionId_channel_status_idx" ON "ContractActionDelivery"("actionId", "channel", "status");

ALTER TABLE "Activity" ADD COLUMN "contractActionId" TEXT;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contractActionId_fkey" FOREIGN KEY ("contractActionId") REFERENCES "ContractAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Activity_contractActionId_idx" ON "Activity"("contractActionId");

ALTER TABLE "Approval" ADD COLUMN "actionId" TEXT;
ALTER TABLE "Approval" ADD COLUMN "actionVersion" INTEGER;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ContractAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Approval_actionId_idx" ON "Approval"("actionId");

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_PROPOSED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_REVIEWED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_ASSIGNED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_ACKNOWLEDGED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_STARTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_REOPENED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_COMPLETED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_BLOCKED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_STALE';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_DISMISSED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_EVIDENCE_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_DELIVERY_ATTEMPTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ACTION_DELIVERED';
