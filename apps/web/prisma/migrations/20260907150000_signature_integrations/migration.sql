-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('DOCUSEAL');

-- CreateTable
CREATE TABLE "SignatureIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "SignatureProvider" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "encryptedWebhookSecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureIntegration_organizationId_key" ON "SignatureIntegration"("organizationId");
CREATE INDEX "SignatureIntegration_organizationId_provider_idx" ON "SignatureIntegration"("organizationId", "provider");

-- AddForeignKey
ALTER TABLE "SignatureIntegration" ADD CONSTRAINT "SignatureIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignatureIntegration" ADD CONSTRAINT "SignatureIntegration_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
