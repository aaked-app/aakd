-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "extractedText" TEXT;

-- CreateTable
CREATE TABLE "AIExtraction" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "rawValue" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceText" TEXT,
    "sourcePage" INTEGER,
    "extractedBy" TEXT NOT NULL DEFAULT 'ai',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAlert" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "triggerDate" TIMESTAMP(3) NOT NULL,
    "firedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractAlert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAlert" ADD CONSTRAINT "ContractAlert_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
