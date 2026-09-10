import { z } from "zod"

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()

export const ExtractionPreviewResultSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  contractType: z.enum(["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"]).nullable().optional(),
  counterpartyName: z.string().max(500).nullable().optional(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  value: z.number().finite().nullable().optional(),
  currency: z.enum(["USD", "EUR", "GBP", "JPY", "OTHER"]).nullable().optional(),
  paymentTerms: z.string().max(2000).nullable().optional(),
  governingLaw: z.string().max(1000).nullable().optional(),
  autoRenewal: z.boolean().optional(),
  renewalDate: DateSchema.optional(),
  noticePeriodDays: z.number().int().min(0).max(36_500).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  confidence: z.record(z.string().max(100), z.number().min(0).max(1)),
  error: z.enum(["ai_unavailable", "text_extraction_failed"]).optional(),
  partial: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (Object.keys(value.confidence ?? {}).length > 20) {
    ctx.addIssue({ code: "custom", path: ["confidence"], message: "Too many confidence fields" })
  }
})

export type ExtractionPreviewResult = z.infer<typeof ExtractionPreviewResultSchema>
