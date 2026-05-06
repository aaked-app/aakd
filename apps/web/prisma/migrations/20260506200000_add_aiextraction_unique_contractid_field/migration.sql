-- AddUniqueConstraint: AIExtraction (contractId, field)
-- Required for upsert operations in the AI extraction worker.
CREATE UNIQUE INDEX "AIExtraction_contractId_field_key" ON "AIExtraction"("contractId", "field");
