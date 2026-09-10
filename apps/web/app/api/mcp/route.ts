import { resolveAuth } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { agreementAccessSql, agreementAccessWhere, agreementRelationWhere, hasAgreementAccess, isAgreementAccessEmergencyDenyAll, type AgreementPrincipal } from "@/lib/auth/agreement-access"
import { requestContext, type RequestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { ACTION_LIST_SELECT, actionDetailSelect, toActionDetail, toActionListItem } from "@/lib/actions/dto"
import {
  AgentProposalError,
  previewActionApprovalRequest,
  previewActionProposal,
  submitActionApprovalRequest,
  submitActionProposal,
} from "@/lib/actions/agent-proposals"
import {
  ActionApprovalRequestPreviewInputSchema,
  ActionApprovalRequestSubmitInputSchema,
  ActionProposalPreviewInputSchema,
  ActionProposalSubmitInputSchema,
} from "@/lib/actions/agent-proposal-schema"
import { enqueueInteractiveAiRequest, waitForInteractiveAiRequest } from "@/lib/jobs/interactive-ai-client"
import { getInteractiveAiQueue } from "@/lib/jobs/queues"
import { rateLimit } from "@/lib/rate-limit"
import { Prisma } from "@prisma/client"
import { z } from "zod"

// MCP tool calls include semantic search + LLM inference. Pin to Fluid Compute ceiling.
export const maxDuration = 300

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

interface McpRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: unknown
}

/** Contract text is a separate capability from metadata reads. */
function canReadContractText(ctx: { role: string; source: "session" | "api_key"; scopes?: string[] }) {
  return hasRole(ctx.role, "member") && (ctx.source !== "api_key" ? true : ctx.scopes?.includes("text_read") === true)
}

function jsonRpcResult(id: string | number, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result })
}

function jsonRpcError(id: string | number, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } })
}

function toolError(id: string | number, message: string) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: message }],
      isError: true,
    },
  })
}

function toolSuccess(id: string | number, data: unknown) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    },
  })
}

// ---------------------------------------------------------------------------
// Tool definitions (returned by tools/list)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "search_contracts",
    description:
      "Search contracts by text query. Returns matching contracts with title, status, counterparty, and value.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text" },
        status: {
          type: "string",
          enum: [
            "DRAFT",
            "INTERNAL_REVIEW",
            "PENDING_APPROVAL",
            "AWAITING_SIGNATURE",
            "ACTIVE",
            "EXPIRED",
            "TERMINATED",
            "ARCHIVED",
          ],
          description: "Filter by status (optional)",
        },
        limit: { type: "number", description: "Max results, default 10, max 50" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_contract",
    description: "Get full details of a single contract by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Contract ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_contracts",
    description: "List contracts with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        contractType: { type: "string" },
        limit: { type: "number", description: "Default 20, max 100" },
        page: { type: "number", description: "Default 1" },
      },
    },
  },
  {
    name: "semantic_search",
    description:
      "Search contracts using semantic (vector) similarity. Finds contracts that are conceptually relevant to the query, even without exact keyword matches.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        limit: { type: "number", description: "Max results, default 10, max 50" },
      },
      required: ["query"],
    },
  },
  {
    name: "ask_contract",
    description:
      "Ask a question about a specific contract and get an AI-generated answer based on the contract text.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "Contract ID" },
        question: { type: "string", description: "Question to ask about the contract" },
      },
      required: ["contractId", "question"],
    },
  },
  {
    name: "get_ai_request",
    description: "Continue a pending AI request without creating or charging for a new job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Pending AI request ID returned by semantic_search or ask_contract" },
      },
      required: ["jobId"],
    },
  },
  // ── M7 Obligations ────────────────────────────────────────────────────────
  {
    name: "list_obligations",
    description: "List all obligations for a contract, ordered by due date.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "Contract ID" },
        status: {
          type: "string",
          enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE"],
          description: "Filter by status (optional)",
        },
      },
      required: ["contractId"],
    },
  },
  {
    name: "list_actions",
    description: "List organization-scoped contract actions with owners, deadlines, status and source metadata. Raw source text requires text_read.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PROPOSED", "PENDING_REVIEW", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "STALE", "DISMISSED"] },
        kind: { type: "string", enum: ["OBLIGATION", "RENEWAL_NOTICE", "EXPIRY", "CUSTOM"] },
        limit: { type: "number", description: "Max results, default 20, max 100" },
        page: { type: "number", description: "Page number, default 1" },
      },
    },
  },
  {
    name: "get_action",
    description: "Get one organization-scoped action with minimized approval, evidence, delivery and activity context. Source text requires text_read.",
    inputSchema: {
      type: "object",
      properties: { actionId: { type: "string" } },
      required: ["actionId"],
    },
  },
  {
    name: "preview_action_proposal",
    description: "Preview one source-linked action draft. Creates nothing and always requires human review.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        contractId: { type: "string" }, kind: { type: "string", enum: ["OBLIGATION", "RENEWAL_NOTICE", "EXPIRY", "CUSTOM"] },
        title: { type: "string" }, description: { type: ["string", "null"] }, condition: { type: ["string", "null"] },
        dueDate: { type: ["string", "null"] }, noticeDate: { type: ["string", "null"] }, evidenceRequired: { type: ["string", "null"] },
        source: { type: "object", additionalProperties: false, properties: { fileId: { type: "string" }, fileVersion: { type: "integer", minimum: 1 }, page: { type: ["integer", "null"], minimum: 1 }, excerpt: { type: "string" }, excerptHash: { type: "string" } }, required: ["fileId", "fileVersion", "excerpt", "excerptHash"] },
        idempotencyKey: { type: "string", format: "uuid" },
      },
      required: ["contractId", "kind", "title", "source", "idempotencyKey"],
    },
  },
  {
    name: "propose_action",
    description: "Submit an unchanged preview as a pending human-review action. Does not validate, assign, approve, execute, or deliver it.",
    inputSchema: { type: "object", additionalProperties: false, properties: { previewId: { type: "string", format: "uuid" }, contractId: { type: "string" }, idempotencyKey: { type: "string", format: "uuid" }, sourceFileId: { type: "string" }, sourceFileVersion: { type: "integer", minimum: 1 }, sourceHash: { type: "string" } }, required: ["previewId", "contractId", "idempotencyKey", "sourceFileId", "sourceFileVersion", "sourceHash"] },
  },
  {
    name: "preview_action_approval_request",
    description: "Preview a request for one named human to decide a reviewed proposed action. Creates nothing.",
    inputSchema: { type: "object", additionalProperties: false, properties: { actionId: { type: "string" }, assignedToId: { type: "string" }, expectedVersion: { type: "integer", minimum: 0 }, comment: { type: ["string", "null"] }, idempotencyKey: { type: "string", format: "uuid" } }, required: ["actionId", "assignedToId", "expectedVersion", "idempotencyKey"] },
  },
  {
    name: "request_action_approval",
    description: "Create one pending, version-bound approval request for the named human. The agent cannot decide it.",
    inputSchema: { type: "object", additionalProperties: false, properties: { previewId: { type: "string", format: "uuid" }, actionId: { type: "string" }, expectedVersion: { type: "integer", minimum: 0 }, idempotencyKey: { type: "string", format: "uuid" } }, required: ["previewId", "actionId", "expectedVersion", "idempotencyKey"] },
  },
  // ── M8 Analytics ─────────────────────────────────────────────────────────
  {
    name: "get_analytics_summary",
    description:
      "Get analytics summary for the organization: expiring contracts, contract counts by status, monthly volume, value by type, approval funnel, and obligation health.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // ── M9 CRM ────────────────────────────────────────────────────────────────
  {
    name: "list_crm_links",
    description: "List CRM deal links (HubSpot, Salesforce, Pipedrive) for a contract.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "Contract ID" },
      },
      required: ["contractId"],
    },
  },
  // ── M10 Import ────────────────────────────────────────────────────────────
  {
    name: "list_import_jobs",
    description: "List contract import jobs for the organization, most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results, default 20, max 100" },
        page: { type: "number", description: "Page number, default 1" },
      },
    },
  },
  {
    name: "get_import_job",
    description: "Get details and row-level status of a specific import job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Import job ID" },
      },
      required: ["jobId"],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool argument schemas (Zod)
// ---------------------------------------------------------------------------

const SearchContractsSchema = z.object({
  query: z.string().min(1),
  status: z
    .enum([
      "DRAFT",
      "INTERNAL_REVIEW",
      "PENDING_APPROVAL",
      "AWAITING_SIGNATURE",
      "ACTIVE",
      "EXPIRED",
      "TERMINATED",
      "ARCHIVED",
    ])
    .optional(),
  limit: z.number().int().min(1).max(50).default(10),
})

const GetContractSchema = z.object({
  id: z.string().min(1),
})

const ListContractsSchema = z.object({
  status: z.string().optional(),
  contractType: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
})

const SemanticSearchMcpSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  limit: z.number().int().min(1).max(50).default(10),
})

const AskContractMcpSchema = z.object({
  contractId: z.string().min(1),
  question: z.string().trim().min(1).max(2000),
})

const GetAiRequestMcpSchema = z.object({ jobId: z.string().uuid() })

// M7
const ListObligationsSchema = z.object({
  contractId: z.string().min(1),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE"]).optional(),
})

const ListActionsMcpSchema = z.object({
  status: z.enum(["PROPOSED", "PENDING_REVIEW", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "STALE", "DISMISSED"]).optional(),
  kind: z.enum(["OBLIGATION", "RENEWAL_NOTICE", "EXPIRY", "CUSTOM"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER - 1).default(1),
})
const GetActionMcpSchema = z.object({ actionId: z.string().min(1) })

// M9
const ListCrmLinksSchema = z.object({
  contractId: z.string().min(1),
})

// M10
const ListImportJobsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
})

const GetImportJobSchema = z.object({
  jobId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolSearchContracts(
  args: unknown,
  ctx: AgreementPrincipal,
  id: string | number,
): Promise<Response> {
  const parsed = SearchContractsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { query: q, status, limit } = parsed.data
  const orgId = ctx.organizationId
  const useIlike = q.length < 3

  type SearchRow = {
    id: string
    title: string
    contractType: string | null
    status: string
    counterpartyName: string | null
    value: number | null
    currency: string | null
    endDate: Date | null
    createdAt: Date
  }

  let results: SearchRow[]

  if (useIlike) {
    results = await prisma.contract.findMany({
      where: agreementAccessWhere(ctx, {
        title: { contains: q, mode: "insensitive" },
        ...(status ? { status } : {}),
      }),
      select: {
        id: true,
        title: true,
        contractType: true,
        status: true,
        counterpartyName: true,
        value: true,
        currency: true,
        endDate: true,
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    })
  } else {
    try {
      results = await prisma.$queryRaw<SearchRow[]>(
        Prisma.sql`
          SELECT
            id,
            title,
            "contractType",
            status,
            "counterpartyName",
            value,
            currency,
            "endDate",
            "createdAt"
          FROM "Contract"
          WHERE "organizationId" = ${orgId}
            AND ${agreementAccessSql("contract", ctx)}
            ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty}
            AND search_tsv @@ plainto_tsquery('english', ${q})
          ORDER BY ts_rank(search_tsv, plainto_tsquery('english', ${q})) DESC
          LIMIT ${limit}
        `,
      )
    } catch {
      // tsquery parse failure — fall back to ILIKE
      results = await prisma.contract.findMany({
        where: agreementAccessWhere(ctx, {
          title: { contains: q, mode: "insensitive" },
          ...(status ? { status } : {}),
        }),
        select: {
          id: true,
          title: true,
          contractType: true,
          status: true,
          counterpartyName: true,
          value: true,
          currency: true,
          endDate: true,
          createdAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      })
    }
  }

  return toolSuccess(id, { results, count: results.length })
}

async function toolGetContract(
  args: unknown,
  ctx: RequestContext,
  id: string | number,
): Promise<Response> {
  const parsed = GetContractSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }
  if (!(await hasAgreementAccess(prisma, ctx, parsed.data.id))) {
    return toolError(id, "Error: Contract not found")
  }

  const contract = await prisma.contract.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      title: true,
      contractType: true,
      status: true,
      ownerId: true,
      counterpartyName: true,
      counterpartyContact: true,
      value: true,
      currency: true,
      governingLaw: true,
      startDate: true,
      endDate: true,
      renewalDate: true,
      noticePeriodDays: true,
      autoRenewal: true,
      notes: true,
      organizationId: true,
      folderId: true,
      riskScore: true,
      riskScoredAt: true,
      docusealSubmissionId: true,
      signingUrl: true,
      signingStatus: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
      tags: { select: { id: true, name: true, color: true } },
      files: {
        where: { isLatest: true },
        select: { id: true, filename: true, mimeType: true, sizeBytes: true, version: true, createdAt: true },
      },
      extractions: {
        select: {
          id: true,
          field: true,
          confidence: true,
          sourcePage: true,
          extractedBy: true,
          status: true,
        },
      },
    },
  })

  if (!contract) {
    return toolError(id, "Error: Contract not found")
  }

  if (contract.organizationId !== ctx.organizationId) {
    return toolError(id, "Error: Contract not found")
  }

  const {
    organizationId: _organizationId,
    extractedText: _extractedText,
    docusealSubmissionId: _docusealSubmissionId,
    signingUrl: _signingUrl,
    ...safeContract
  } =
    contract as typeof contract & { extractedText?: string | null }
  const metadataOnlyApiKey = ctx.source === "api_key" && !ctx.scopes?.includes("text_read")
  const safeExtractions = safeContract.extractions.map((extraction) =>
    Object.fromEntries(
      Object.entries(extraction).filter(
        ([key]) => key !== "rawValue" && key !== "sourceText",
      ),
    ),
  )
  const { notes: _notes, ...metadataOnlyContract } = safeContract
  return toolSuccess(id, {
    ...(metadataOnlyApiKey ? metadataOnlyContract : safeContract),
    extractions: safeExtractions,
  })
}

async function toolListContracts(
  args: unknown,
  ctx: AgreementPrincipal,
  id: string | number,
): Promise<Response> {
  const parsed = ListContractsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { status, contractType, limit, page } = parsed.data

  const where: Record<string, unknown> = {}
  if (status) {
    where.status = status
  } else {
    // Hide soft-deleted contracts unless the caller explicitly asks for them.
    where.status = { not: "ARCHIVED" }
  }
  if (contractType) where.contractType = contractType

  const authorizedWhere = agreementAccessWhere(ctx, where as Prisma.ContractWhereInput)
  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where: authorizedWhere,
      select: {
        id: true,
        title: true,
        contractType: true,
        status: true,
        ownerId: true,
        counterpartyName: true,
        value: true,
        currency: true,
        endDate: true,
        renewalDate: true,
        autoRenewal: true,
        riskScore: true,
        riskScoredAt: true,
        signingStatus: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contract.count({ where: authorizedWhere }),
  ])

  return toolSuccess(id, { contracts, total, page, limit })
}

async function toolSemanticSearch(
  args: unknown,
  ctx: RequestContext,
  id: string | number,
): Promise<Response> {
  const parsed = SemanticSearchMcpSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  let rl: Awaited<ReturnType<typeof rateLimit>>
  try {
    rl = await rateLimit(`${ctx.organizationId}:semantic-search`, 30, 60_000)
  } catch {
    return toolError(id, "Error: Semantic search unavailable")
  }
  if (!rl.allowed) return toolError(id, `Rate limit exceeded — retry after ${rl.retryAfter}s`)

  let submission
  try {
    submission = await enqueueInteractiveAiRequest(ctx, "semantic_search", null, {
      operation: "semantic_search",
      query: parsed.data.query,
      limit: parsed.data.limit,
      threshold: 0.3,
    }, 35_000)
  } catch {
    return toolError(id, "Error: Semantic search unavailable; retry the request")
  }
  if (submission.state === "pending") return toolSuccess(id, {
    status: "pending",
    jobId: submission.jobId,
    next: { tool: "get_ai_request", arguments: { jobId: submission.jobId } },
  })
  if (submission.state === "failed") return toolError(id, "Error: Semantic search failed; retry the request")
  return submission.response.status === 200
    ? toolSuccess(id, submission.response.body)
    : toolError(id, `Error: ${String(submission.response.body.error ?? "Semantic search failed")}`)
}

async function toolAskContract(
  args: unknown,
  ctx: RequestContext,
  id: string | number,
): Promise<Response> {
  const parsed = AskContractMcpSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { contractId, question } = parsed.data
  const orgId = ctx.organizationId

  const rl = await rateLimit(`${orgId}:ask-contract`, 10, 60_000)
  if (!rl.allowed) {
    return toolError(id, `Rate limit exceeded — retry after ${rl.retryAfter}s`)
  }
  if (!(await hasAgreementAccess(prisma, ctx, contractId))) {
    return toolError(id, "Error: Contract not found")
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      title: true,
      extractedText: true,
      organizationId: true,
    },
  })

  if (!contract || contract.organizationId !== ctx.organizationId) {
    return toolError(id, "Error: Contract not found")
  }

  if (!contract.extractedText) {
    return toolError(id, "Error: No extracted text available for this contract")
  }

  let submission
  try {
    submission = await enqueueInteractiveAiRequest(ctx, "contract_question", contractId, {
      operation: "contract_question",
      question,
    }, 35_000)
  } catch {
    return toolError(id, "Error: AI call failed; retry the request")
  }
  if (submission.state === "pending") return toolSuccess(id, {
    status: "pending",
    jobId: submission.jobId,
    next: { tool: "get_ai_request", arguments: { jobId: submission.jobId } },
  })
  if (submission.state === "failed") return toolError(id, "Error: AI call failed; retry the request")
  return submission.response.status === 200
    ? toolSuccess(id, submission.response.body)
    : toolError(id, `Error: ${String(submission.response.body.error ?? "AI call failed")}`)
}

async function toolGetAiRequest(
  args: unknown,
  ctx: RequestContext,
  id: string | number,
): Promise<Response> {
  const parsed = GetAiRequestMcpSchema.safeParse(args)
  if (!parsed.success) return toolError(id, "Error: Invalid AI request ID")
  let submission
  try {
    submission = await waitForInteractiveAiRequest(ctx, parsed.data.jobId)
  } catch {
    return toolError(id, "Error: AI request unavailable")
  }
  if (!submission) return toolError(id, "Error: AI request not found")
  if (submission.state === "pending") return toolSuccess(id, {
    status: "pending",
    jobId: submission.jobId,
    next: { tool: "get_ai_request", arguments: { jobId: submission.jobId } },
  })
  if (submission.state === "failed") return toolError(id, "Error: AI request failed")
  return submission.response.status === 200
    ? toolSuccess(id, submission.response.body)
    : toolError(id, `Error: ${String(submission.response.body.error ?? "AI request failed")}`)
}

// ── M7 Obligations ────────────────────────────────────────────────────────

async function toolListObligations(
  args: unknown,
  ctx: AgreementPrincipal,
  id: string | number,
): Promise<Response> {
  const parsed = ListObligationsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { contractId, status } = parsed.data

  if (!(await hasAgreementAccess(prisma, ctx, contractId))) {
    return toolError(id, "Error: Contract not found")
  }

  const obligations = await prisma.contractObligation.findMany({
    where: {
      contractId,
      organizationId: ctx.organizationId,
      contract: agreementRelationWhere(ctx),
      ...(status ? { status } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      subTasks: { orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  })

  return toolSuccess(id, { obligations: obligations.map(toSafeObligation), count: obligations.length })
}

function toSafeObligation(obligation: {
  id: string
  contractId: string
  title: string
  description?: string | null
  clauseReference?: string | null
  priority: string
  status: string
  dueDate: Date | string
  assignee?: { id: string; name: string | null } | null
  subTasks?: Array<{
    id: string
    title: string
    isCompleted: boolean
    completedAt: Date | string | null
    createdAt: Date | string
    updatedAt: Date | string
  }>
}) {
  return {
    id: obligation.id,
    contractId: obligation.contractId,
    title: obligation.title,
    description: obligation.description ?? null,
    clauseReference: obligation.clauseReference ?? null,
    priority: obligation.priority,
    status: obligation.status,
    dueDate: obligation.dueDate,
    assignee: obligation.assignee
      ? { id: obligation.assignee.id, name: obligation.assignee.name }
      : null,
    subTasks: (obligation.subTasks ?? []).map((subTask) => ({
      id: subTask.id,
      title: subTask.title,
      isCompleted: subTask.isCompleted,
      completedAt: subTask.completedAt,
      createdAt: subTask.createdAt,
      updatedAt: subTask.updatedAt,
    })),
  }
}

async function toolListActions(
  args: unknown,
  ctx: AgreementPrincipal,
  id: string | number,
): Promise<Response> {
  const parsed = ListActionsMcpSchema.safeParse(args)
  if (!parsed.success) return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)

  const { status, kind, limit, page } = parsed.data
  const where = {
    organizationId: ctx.organizationId,
    contract: agreementRelationWhere(ctx),
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.contractAction.findMany({
      where,
      select: ACTION_LIST_SELECT,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contractAction.count({ where }),
  ])

  return toolSuccess(id, {
    actions: rows.map(toActionListItem),
    total,
    page,
    limit,
  })
}

async function toolGetAction(
  args: unknown,
  ctx: AgreementPrincipal,
  includeSourceText: boolean,
  id: string | number,
): Promise<Response> {
  const parsed = GetActionMcpSchema.safeParse(args)
  if (!parsed.success) return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  const action = await prisma.contractAction.findFirst({
    where: { id: parsed.data.actionId, organizationId: ctx.organizationId, contract: agreementRelationWhere(ctx) },
    select: actionDetailSelect(includeSourceText),
  })
  if (!action) return toolError(id, "Error: Action not found")
  return toolSuccess(id, toActionDetail(action as never, includeSourceText))
}

async function actionProposalRateLimit(ctx: RequestContext, id: string | number): Promise<Response | null> {
  try {
    const limited = await rateLimit(`${ctx.organizationId}:action-propose`, 20, 60_000)
    return limited.allowed ? null : toolError(id, `Rate limit exceeded — retry after ${limited.retryAfter}s`)
  } catch {
    return toolError(id, "Error: Action proposal service unavailable")
  }
}

function agentProposalFailure(id: string | number, error: unknown): Response {
  return error instanceof AgentProposalError
    ? toolError(id, `Error: ${error.code}`)
    : toolError(id, "Error: Action proposal service unavailable")
}

async function toolPreviewActionProposal(args: unknown, ctx: RequestContext, id: string | number): Promise<Response> {
  const parsed = ActionProposalPreviewInputSchema.safeParse(args)
  if (!parsed.success) return toolError(id, "Error: Invalid action proposal arguments")
  const limited = await actionProposalRateLimit(ctx, id)
  if (limited) return limited
  try {
    return toolSuccess(id, await previewActionProposal(ctx, parsed.data, await getInteractiveAiQueue().client))
  } catch (error) {
    return agentProposalFailure(id, error)
  }
}

async function toolSubmitActionProposal(args: unknown, ctx: RequestContext, id: string | number): Promise<Response> {
  const parsed = ActionProposalSubmitInputSchema.safeParse(args)
  if (!parsed.success) return toolError(id, "Error: Invalid action proposal arguments")
  const limited = await actionProposalRateLimit(ctx, id)
  if (limited) return limited
  try {
    return toolSuccess(id, await submitActionProposal(ctx, parsed.data, await getInteractiveAiQueue().client))
  } catch (error) {
    return agentProposalFailure(id, error)
  }
}

async function toolPreviewActionApprovalRequest(args: unknown, ctx: RequestContext, id: string | number): Promise<Response> {
  const parsed = ActionApprovalRequestPreviewInputSchema.safeParse(args)
  if (!parsed.success) return toolError(id, "Error: Invalid approval request arguments")
  const limited = await actionProposalRateLimit(ctx, id)
  if (limited) return limited
  try {
    return toolSuccess(id, await previewActionApprovalRequest(ctx, parsed.data, await getInteractiveAiQueue().client))
  } catch (error) {
    return agentProposalFailure(id, error)
  }
}

async function toolSubmitActionApprovalRequest(args: unknown, ctx: RequestContext, id: string | number): Promise<Response> {
  const parsed = ActionApprovalRequestSubmitInputSchema.safeParse(args)
  if (!parsed.success) return toolError(id, "Error: Invalid approval request arguments")
  const limited = await actionProposalRateLimit(ctx, id)
  if (limited) return limited
  try {
    return toolSuccess(id, await submitActionApprovalRequest(ctx, parsed.data, await getInteractiveAiQueue().client))
  } catch (error) {
    return agentProposalFailure(id, error)
  }
}

// ── M8 Analytics ─────────────────────────────────────────────────────────

async function toolGetAnalyticsSummary(
  ctx: AgreementPrincipal,
  id: string | number,
): Promise<Response> {
  const now = new Date()
  const DAY_MS = 86_400_000
  const d30 = new Date(now.getTime() + 30 * DAY_MS)
  const d60 = new Date(now.getTime() + 60 * DAY_MS)
  const d90 = new Date(now.getTime() + 90 * DAY_MS)

  const twelveMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  )

  const [next30, next60, next90, expiringContracts] = await Promise.all([
    prisma.contract.count({ where: agreementAccessWhere(ctx, { status: "ACTIVE", endDate: { gte: now, lte: d30 } }) }),
    prisma.contract.count({ where: agreementAccessWhere(ctx, { status: "ACTIVE", endDate: { gte: now, lte: d60 } }) }),
    prisma.contract.count({ where: agreementAccessWhere(ctx, { status: "ACTIVE", endDate: { gte: now, lte: d90 } }) }),
    prisma.contract.findMany({
      where: agreementAccessWhere(ctx, { status: "ACTIVE", endDate: { gte: now, lte: d90 } }),
      orderBy: { endDate: "asc" },
      take: 10,
      select: { id: true, title: true, endDate: true, counterpartyName: true, contractType: true },
    }),
  ])

  const expiringSoon = {
    next30,
    next60,
    next90,
    contracts: expiringContracts.map((c) => ({
      id: c.id,
      title: c.title,
      endDate: c.endDate ? c.endDate.toISOString() : "",
      counterpartyName: c.counterpartyName ?? null,
      contractType: c.contractType ?? null,
      daysUntilExpiry: c.endDate
        ? Math.ceil((c.endDate.getTime() - now.getTime()) / DAY_MS)
        : 0,
    })),
  }

  const grouped = await prisma.contract.groupBy({
    by: ["status"],
    where: agreementAccessWhere(ctx),
    _count: { _all: true },
  })
  const byStatus = grouped.map((g) => ({ status: g.status, count: g._count._all }))

  const rows = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>(Prisma.sql`
    SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
           COUNT(*)::bigint AS count
    FROM "Contract"
    WHERE "organizationId" = ${ctx.organizationId}
      AND ${agreementAccessSql("contract", ctx)}
      AND "createdAt" >= ${twelveMonthsAgo}
    GROUP BY 1
    ORDER BY 1 ASC
  `)
  const rowsByMonth = new Map(rows.map((r) => [r.month, Number(r.count)]))
  const monthlyVolume: Array<{ month: string; count: number }> = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(
      Date.UTC(twelveMonthsAgo.getUTCFullYear(), twelveMonthsAgo.getUTCMonth() + i, 1),
    )
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const key = `${y}-${m}`
    monthlyVolume.push({ month: key, count: rowsByMonth.get(key) ?? 0 })
  }

  const valueGrouped = await prisma.contract.groupBy({
    by: ["contractType"],
    where: agreementAccessWhere(ctx, { value: { not: null } }),
    _sum: { value: true },
    _count: { _all: true },
  })
  const valueByType = valueGrouped
    .filter((g) => g.contractType !== null)
    .map((g) => ({
      contractType: g.contractType as string,
      totalValue: g._sum.value ?? 0,
      count: g._count._all,
    }))

  const approvalScope = { contract: agreementAccessWhere(ctx) }
  const [totalRequested, approvedCount, rejectedCount] = await Promise.all([
    prisma.approval.count({ where: approvalScope }),
    prisma.approval.count({ where: { ...approvalScope, status: "approved" } }),
    prisma.approval.count({ where: { ...approvalScope, status: "rejected" } }),
  ])
  const approvalFunnel = {
    totalRequested,
    approved: approvedCount,
    rejected: rejectedCount,
    pending: Math.max(0, totalRequested - approvedCount - rejectedCount),
  }

  let obligations: { overdue: number; dueSoon: number } | null = null
  try {
    const dueSoonCutoff = new Date(now.getTime() + 7 * DAY_MS)
    const oblScope = { contract: agreementAccessWhere(ctx) }
    const [overdue, dueSoon] = await Promise.all([
      prisma.contractObligation.count({ where: { ...oblScope, status: "OVERDUE" } }),
      prisma.contractObligation.count({
        where: {
          ...oblScope,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lte: dueSoonCutoff },
        },
      }),
    ])
    obligations = { overdue, dueSoon }
  } catch {
    obligations = null
  }

  return toolSuccess(id, {
    expiringSoon,
    byStatus,
    monthlyVolume,
    valueByType,
    approvalFunnel,
    obligations,
  })
}

// ── M9 CRM ────────────────────────────────────────────────────────────────

async function toolListCrmLinks(
  args: unknown,
  ctx: AgreementPrincipal,
  id: string | number,
): Promise<Response> {
  const parsed = ListCrmLinksSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { contractId } = parsed.data

  if (!(await hasAgreementAccess(prisma, ctx, contractId))) {
    return toolError(id, "Error: Contract not found")
  }

  const links = await prisma.crmLink.findMany({
    where: { contractId, contract: agreementRelationWhere(ctx) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      provider: true,
      externalDealId: true,
      externalDealName: true,
      externalDealUrl: true,
      lastSyncedAt: true,
      lastSyncStatus: true,
      createdAt: true,
    },
  })

  return toolSuccess(id, { links, count: links.length })
}

// ── M10 Import ────────────────────────────────────────────────────────────

async function toolListImportJobs(
  args: unknown,
  ctx: AgreementPrincipal & { userId: string },
  id: string | number,
): Promise<Response> {
  const parsed = ListImportJobsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { limit, page } = parsed.data
  if (isAgreementAccessEmergencyDenyAll()) return toolSuccess(id, { jobs: [], total: 0, page, limit })
  type ImportJobRow = {
    id: string; source: string; status: string; totalRows: number; succeededRows: number;
    failedRows: number; createdAt: Date; completedAt: Date | null; createdById: string;
    createdByName: string; accessibleTotal: bigint
  }
  const jobs = await prisma.$queryRaw<ImportJobRow[]>(Prisma.sql`
    SELECT job."id", job."source"::text AS "source", job."status"::text AS "status",
           job."totalRows", job."succeededRows", job."failedRows", job."createdAt", job."completedAt",
           creator."id" AS "createdById", creator."name" AS "createdByName",
           COUNT(*) OVER()::bigint AS "accessibleTotal"
    FROM "ImportJob" AS job
    INNER JOIN "User" AS creator ON creator."id" = job."createdById"
    WHERE job."organizationId" = ${ctx.organizationId}
      AND NOT EXISTS (
        SELECT 1 FROM "ImportRow" AS inaccessible_row
        WHERE inaccessible_row."jobId" = job."id"
          AND inaccessible_row."contractId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "ContractAccessGrant" AS access_grant
            WHERE access_grant."organizationId" = ${ctx.organizationId}
              AND access_grant."memberId" = ${ctx.memberId ?? null}
              AND access_grant."contractId" = inaccessible_row."contractId"
          )
      )
      AND (
        job."createdById" = ${ctx.userId}
        OR (
          EXISTS (SELECT 1 FROM "ImportRow" AS present_row WHERE present_row."jobId" = job."id")
          AND NOT EXISTS (
            SELECT 1 FROM "ImportRow" AS unbound_row
            WHERE unbound_row."jobId" = job."id" AND unbound_row."contractId" IS NULL
          )
        )
      )
    ORDER BY job."createdAt" DESC
    OFFSET ${(page - 1) * limit}
    LIMIT ${limit}
  `)
  const total = jobs.length > 0 ? Number(jobs[0].accessibleTotal) : 0

  return toolSuccess(id, {
    jobs: jobs.map((job) => ({
      id: job.id,
      source: job.source,
      status: job.status,
      totalRows: job.totalRows,
      succeededRows: job.succeededRows,
      failedRows: job.failedRows,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      createdBy: { id: job.createdById, name: job.createdByName },
    })),
    total,
    page,
    limit,
  })
}

async function toolGetImportJob(
  args: unknown,
  ctx: AgreementPrincipal & { userId: string },
  id: string | number,
  includeSensitiveRows: boolean,
): Promise<Response> {
  if (isAgreementAccessEmergencyDenyAll()) return toolError(id, "Error: Import job not found")
  const parsed = GetImportJobSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const job = await prisma.importJob.findUnique({
    where: { id: parsed.data.jobId },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  if (!job || job.organizationId !== ctx.organizationId) {
    return toolError(id, "Error: Import job not found")
  }

  // For large jobs, only return failed rows to keep response size reasonable
  const FULL_ROW_THRESHOLD = 200
  const rowWhere =
    job.totalRows > FULL_ROW_THRESHOLD
      ? { jobId: job.id, status: "failed" }
      : { jobId: job.id }

  const accessRows = await prisma.importRow.findMany({
    where: { jobId: job.id },
    select: { contractId: true },
  })
  const rows = await prisma.importRow.findMany({
    where: rowWhere,
    orderBy: { rowIndex: "asc" },
    select: {
      id: true,
      rowIndex: true,
      sourceRef: true,
      status: true,
      errorMessage: true,
      contractId: true,
    },
  })

  const contractIds = [...new Set(accessRows.flatMap((row) => row.contractId ? [row.contractId] : []))]
  const grants = ctx.memberId && contractIds.length > 0
    ? await prisma.contractAccessGrant.findMany({
      where: { organizationId: ctx.organizationId, memberId: ctx.memberId, contractId: { in: contractIds } },
      select: { contractId: true },
    })
    : []
  const grantedContractIds = new Set(grants.map((grant) => grant.contractId))
  const hasUnboundRows = accessRows.some((row) => row.contractId === null)
  if (
    contractIds.some((contractId) => !grantedContractIds.has(contractId))
    || (hasUnboundRows && job.createdById !== ctx.userId)
    || (accessRows.length === 0 && job.createdById !== ctx.userId)
  ) {
    return toolError(id, "Error: Import job not found")
  }

  return toolSuccess(id, {
    job: {
      id: job.id,
      source: job.source,
      status: job.status,
      totalRows: job.totalRows,
      succeededRows: job.succeededRows,
      failedRows: job.failedRows,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdBy: job.createdBy ? { id: job.createdBy.id, name: job.createdBy.name } : null,
    },
    rows: rows.map((row) => ({
      id: row.id,
      rowIndex: row.rowIndex,
      status: row.status,
      contractId: row.contractId,
      sourceRef: includeSensitiveRows ? row.sourceRef : null,
      errorMessage: includeSensitiveRows ? row.errorMessage : null,
    })),
    rowsNote: job.totalRows > FULL_ROW_THRESHOLD ? "Only failed rows shown for large jobs" : null,
  })
}

// ---------------------------------------------------------------------------
// Main POST handler
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  return Response.json({
    name: "Aakd MCP",
    protocol: "json-rpc-2.0",
    endpoint: "/api/mcp",
    tools: TOOLS,
  })
}

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  const contentLength = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
    return new Response("Request body too large", { status: 413 })
  }

  let body: unknown
  try {
    const rawBody = await req.text()
    if (rawBody.length > 1_000_000) return new Response("Request body too large", { status: 413 })
    body = JSON.parse(rawBody) as unknown
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  // JSON-RPC 2.0 notifications have no `id` — they don't expect a response.
  // Accept and silently acknowledge them (e.g. notifications/initialized).
  const raw = body as Record<string, unknown>
  if (
    raw &&
    typeof raw === "object" &&
    raw.jsonrpc === "2.0" &&
    typeof raw.method === "string" &&
    raw.id === undefined
  ) {
    return new Response(null, { status: 202 })
  }

  // Validate JSON-RPC request envelope
  const envelope = body as McpRequest
  if (
    !envelope ||
    typeof envelope !== "object" ||
    envelope.jsonrpc !== "2.0" ||
    typeof envelope.method !== "string" ||
    (typeof envelope.id !== "string" && typeof envelope.id !== "number")
  ) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      { status: 400 },
    )
  }

  const { id, method, params } = envelope

  return requestContext.run(ctx, async () => {
    // initialize — MCP 2024-11-05 handshake (required by all standard clients)
    if (method === "initialize") {
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "Aakd MCP", version: "1.0.0" },
      })
    }

    // ping — keepalive
    if (method === "ping") {
      return jsonRpcResult(id, {})
    }

    // tools/list
    if (method === "tools/list") {
      return jsonRpcResult(id, { tools: TOOLS })
    }

    // tools/call
    if (method === "tools/call") {
      const callParams = params as { name?: string; arguments?: Record<string, unknown> } | undefined
      const toolName = callParams?.name
      const toolArgs = callParams?.arguments ?? {}

      if (!toolName) {
        return jsonRpcError(id, -32602, "Invalid params: missing tool name")
      }

      switch (toolName) {
        case "search_contracts":
          return toolSearchContracts(toolArgs, ctx, id)
        case "get_contract":
          return toolGetContract(toolArgs, ctx, id)
        case "list_contracts":
          return toolListContracts(toolArgs, ctx, id)
        case "semantic_search":
          return toolSemanticSearch(toolArgs, ctx, id)
        case "ask_contract":
          if (!canReadContractText(ctx)) {
            return toolError(id, "Error: Contract text access requires a member role and the text_read scope")
          }
          return toolAskContract(toolArgs, ctx, id)
        case "get_ai_request":
          return toolGetAiRequest(toolArgs, ctx, id)
        // M7 Obligations
        case "list_obligations":
          return toolListObligations(toolArgs, ctx, id)
        case "list_actions":
          return toolListActions(toolArgs, ctx, id)
        case "get_action":
          return toolGetAction(toolArgs, ctx, canReadContractText(ctx), id)
        case "preview_action_proposal":
          return toolPreviewActionProposal(toolArgs, ctx, id)
        case "propose_action":
          return toolSubmitActionProposal(toolArgs, ctx, id)
        case "preview_action_approval_request":
          return toolPreviewActionApprovalRequest(toolArgs, ctx, id)
        case "request_action_approval":
          return toolSubmitActionApprovalRequest(toolArgs, ctx, id)
        // M8 Analytics
        case "get_analytics_summary":
          return toolGetAnalyticsSummary(ctx, id)
        // M9 CRM
        case "list_crm_links":
          return toolListCrmLinks(toolArgs, ctx, id)
        // M10 Import
        case "list_import_jobs":
          if (!hasRole(ctx.role, "member")) {
            return toolError(id, "Error: Import access requires a member role")
          }
          if (!ctx.memberId) return toolError(id, "Error: Current membership required")
          return toolListImportJobs(toolArgs, ctx, id)
        case "get_import_job":
          if (!hasRole(ctx.role, "member")) {
            return toolError(id, "Error: Import access requires a member role")
          }
          if (!ctx.memberId) return toolError(id, "Error: Current membership required")
          return toolGetImportJob(toolArgs, ctx, id, canReadContractText(ctx))
        default:
          return toolError(id, `Error: Unknown tool "${toolName}"`)
      }
    }

    // Unknown method
    return jsonRpcError(id, -32601, "Method not found")
  })
}
