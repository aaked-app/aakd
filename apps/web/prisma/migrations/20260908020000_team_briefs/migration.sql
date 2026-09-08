CREATE TABLE "TeamBrief" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "publishedById" TEXT NOT NULL,
  "audienceUserId" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamBriefItem" (
  "id" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "actionVersion" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "condition" TEXT,
  "dueDate" TIMESTAMP(3),
  "sourceText" TEXT,
  "sourcePage" INTEGER,
  "confidence" DOUBLE PRECISION,
  "assigneeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamBriefItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamBrief_organizationId_createdAt_idx" ON "TeamBrief"("organizationId", "createdAt");
CREATE INDEX "TeamBrief_audienceUserId_createdAt_idx" ON "TeamBrief"("audienceUserId", "createdAt");
CREATE UNIQUE INDEX "TeamBriefItem_briefId_actionId_key" ON "TeamBriefItem"("briefId", "actionId");
CREATE INDEX "TeamBriefItem_actionId_idx" ON "TeamBriefItem"("actionId");

ALTER TABLE "TeamBrief"
  ADD CONSTRAINT "TeamBrief_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamBrief"
  ADD CONSTRAINT "TeamBrief_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamBrief"
  ADD CONSTRAINT "TeamBrief_audienceUserId_fkey" FOREIGN KEY ("audienceUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamBriefItem"
  ADD CONSTRAINT "TeamBriefItem_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "TeamBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamBriefItem"
  ADD CONSTRAINT "TeamBriefItem_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ContractAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
