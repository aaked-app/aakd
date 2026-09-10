import { createHash } from "node:crypto"
import { z } from "zod"

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const IdempotencyKeySchema = z.string().uuid()
const OptionalTrimmedString = (max: number) => z.string().max(max).transform(value => value.trim()).nullable().optional()
export const ACTION_PROPOSAL_KINDS = ["OBLIGATION", "RENEWAL_NOTICE", "EXPIRY", "CUSTOM"] as const

export function actionDateSemanticIssue(input: {
  kind: (typeof ACTION_PROPOSAL_KINDS)[number]
  dueDate?: string | null
  noticeDate?: string | null
}): string | null {
  if (input.kind !== "RENEWAL_NOTICE") return input.noticeDate ? "action_notice_date_not_applicable" : null
  if (!input.noticeDate) return "action_notice_date_required"
  if (input.dueDate && Date.parse(input.noticeDate) > Date.parse(input.dueDate)) return "action_notice_after_due_date"
  return null
}

export const ActionProposalPreviewInputSchema = z.object({
  contractId: z.string().min(1).max(200),
  kind: z.enum(ACTION_PROPOSAL_KINDS),
  title: z.string().min(1).max(300).transform(value => value.trim()).pipe(z.string().min(1)),
  description: OptionalTrimmedString(2000),
  condition: OptionalTrimmedString(2000),
  dueDate: z.string().datetime().nullable().optional(),
  noticeDate: z.string().datetime().nullable().optional(),
  evidenceRequired: OptionalTrimmedString(80),
  source: z.object({
    fileId: z.string().min(1).max(200),
    fileVersion: z.number().int().positive(),
    page: z.number().int().positive().nullable().optional(),
    excerpt: z.string().min(1).max(8192),
    excerptHash: Sha256Schema,
  }).strict(),
  idempotencyKey: IdempotencyKeySchema,
}).strict().superRefine((input, ctx) => {
  const issue = actionDateSemanticIssue(input)
  if (issue) ctx.addIssue({ code: "custom", path: ["noticeDate"], message: issue })
})

export const ActionProposalSubmitInputSchema = z.object({
  previewId: z.string().uuid(),
  contractId: z.string().min(1).max(200),
  idempotencyKey: IdempotencyKeySchema,
  sourceFileId: z.string().min(1).max(200),
  sourceFileVersion: z.number().int().positive(),
  sourceHash: Sha256Schema,
}).strict()

export const ActionApprovalRequestPreviewInputSchema = z.object({
  actionId: z.string().min(1).max(200),
  assignedToId: z.string().min(1).max(200),
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  comment: OptionalTrimmedString(2000),
  idempotencyKey: IdempotencyKeySchema,
}).strict()

export const ActionApprovalRequestSubmitInputSchema = z.object({
  previewId: z.string().uuid(),
  actionId: z.string().min(1).max(200),
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  idempotencyKey: IdempotencyKeySchema,
}).strict()

export type ActionProposalPreviewInput = z.infer<typeof ActionProposalPreviewInputSchema>
export type ActionProposalSubmitInput = z.infer<typeof ActionProposalSubmitInputSchema>
export type ActionApprovalRequestPreviewInput = z.infer<typeof ActionApprovalRequestPreviewInputSchema>
export type ActionApprovalRequestSubmitInput = z.infer<typeof ActionApprovalRequestSubmitInputSchema>

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function actionProposalDigest(input: ActionProposalPreviewInput): string {
  return sha256Json({
    contractId: input.contractId,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    condition: input.condition?.trim() || null,
    dueDate: input.dueDate ?? null,
    noticeDate: input.noticeDate ?? null,
    evidenceRequired: input.evidenceRequired?.trim() || null,
    source: {
      fileId: input.source.fileId,
      fileVersion: input.source.fileVersion,
      page: input.source.page ?? null,
      excerpt: input.source.excerpt,
      excerptHash: input.source.excerptHash,
    },
  })
}

export function actionApprovalRequestDigest(input: ActionApprovalRequestPreviewInput): string {
  return sha256Json({
    actionId: input.actionId,
    assignedToId: input.assignedToId,
    expectedVersion: input.expectedVersion,
    comment: input.comment?.trim() || null,
  })
}

export function actionProposalIdempotencyHash(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey).digest("hex")
}
