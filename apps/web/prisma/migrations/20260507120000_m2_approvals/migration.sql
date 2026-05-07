-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
