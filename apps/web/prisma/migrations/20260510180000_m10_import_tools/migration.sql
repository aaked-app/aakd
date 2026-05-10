-- M10: Import / Migration Tools
-- Adds ImportJob, ImportRow, GoogleDriveIntegration models, ImportSource +
-- ImportStatus enums, and the IMPORT_COMPLETED ActivityAction value.

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('CSV', 'BATCH_FILES', 'GOOGLE_DRIVE', 'PANDADOC', 'CLM_EXPORT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum: extend ActivityAction with IMPORT_COMPLETED
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'IMPORT_COMPLETED';

-- CreateTable: ImportJob
CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "source" "ImportSource" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "storageKey" TEXT,
  "driveFileIds" TEXT,
  "mappingJson" TEXT,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "succeededRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "errorReportKey" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ImportJob_organizationId_status_idx" ON "ImportJob" ("organizationId", "status");
CREATE INDEX "ImportJob_organizationId_createdAt_idx" ON "ImportJob" ("organizationId", "createdAt");

-- CreateTable: ImportRow
CREATE TABLE "ImportRow" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "contractId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ImportRow_jobId_status_idx" ON "ImportRow" ("jobId", "status");
CREATE INDEX "ImportRow_jobId_rowIndex_idx" ON "ImportRow" ("jobId", "rowIndex");

-- CreateTable: GoogleDriveIntegration
CREATE TABLE "GoogleDriveIntegration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "connectedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleDriveIntegration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoogleDriveIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GoogleDriveIntegration_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoogleDriveIntegration_organizationId_key" ON "GoogleDriveIntegration" ("organizationId");
