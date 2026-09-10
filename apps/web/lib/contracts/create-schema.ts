import { z } from "zod"

export const CreateContractSchema = z.object({
  title: z.string().trim().min(1).max(500),
  contractType: z.enum(["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"]).optional(),
  counterpartyName: z.string().optional(),
  counterpartyContact: z.string().email().optional().or(z.literal("")),
  value: z.number().positive().optional(),
  currency: z.string().min(1).max(10).default("USD"),
  governingLaw: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  renewalDate: z.string().date().optional(),
  noticePeriodDays: z.number().int().min(0).optional(),
  autoRenewal: z.boolean().default(false),
  renewalReminderEnabled: z.boolean().default(true),
  notes: z.string().max(10000).optional(),
  folderId: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
})

export const IntakeContractMetadataSchema = CreateContractSchema.strict()

export type CreateContractInput = z.infer<typeof CreateContractSchema>

export function stripContractHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "")
}

export function normalizeCreateContractInput(input: CreateContractInput): CreateContractInput {
  const title = stripContractHtml(input.title).trim()
  if (!title) throw new Error("contract_title_required")
  return {
    ...input,
    title,
    counterpartyName: input.counterpartyName ? stripContractHtml(input.counterpartyName) : input.counterpartyName,
    notes: input.notes ? stripContractHtml(input.notes) : input.notes,
    tagIds: [...input.tagIds].sort(),
  }
}

export function withoutContractIntakeIdentity<T extends Record<string, unknown>>(
  contract: T,
): Omit<T, "intakeRequestId" | "intakeRequestHash" | "intakeRequestedByMemberId"> {
  const publicContract = { ...contract }
  delete publicContract.intakeRequestId
  delete publicContract.intakeRequestHash
  delete publicContract.intakeRequestedByMemberId
  return publicContract
}
