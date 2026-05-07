import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { Prisma } from "@prisma/client"
import { z } from "zod"

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

interface McpRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: unknown
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
    name: "create_contract",
    description:
      "Create a new contract record (no file upload). Returns the created contract ID.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        contractType: {
          type: "string",
          enum: ["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"],
        },
        counterpartyName: { type: "string" },
        counterpartyContact: { type: "string", description: "Email address" },
        value: { type: "number" },
        currency: { type: "string" },
        startDate: { type: "string", description: "ISO date YYYY-MM-DD" },
        endDate: { type: "string", description: "ISO date YYYY-MM-DD" },
        notes: { type: "string" },
      },
      required: ["title"],
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

const CreateContractSchema = z.object({
  title: z.string().min(1).max(500),
  contractType: z
    .enum(["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"])
    .optional(),
  counterpartyName: z.string().optional(),
  counterpartyContact: z.string().email().optional().or(z.literal("")),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  notes: z.string().max(10000).optional(),
})

const ListContractsSchema = z.object({
  status: z.string().optional(),
  contractType: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
})

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolSearchContracts(
  args: unknown,
  orgId: string,
  id: string | number,
): Promise<Response> {
  const parsed = SearchContractsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { query: q, status, limit } = parsed.data
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
      where: {
        organizationId: orgId,
        title: { contains: q, mode: "insensitive" },
        ...(status ? { status } : {}),
      },
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
            ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty}
            AND to_tsvector('english',
              coalesce(title, '') || ' ' ||
              coalesce("counterpartyName", '') || ' ' ||
              coalesce(notes, '') || ' ' ||
              coalesce("extractedText", '')
            ) @@ plainto_tsquery('english', ${q})
          ORDER BY ts_rank(
            to_tsvector('english',
              coalesce(title, '') || ' ' ||
              coalesce("counterpartyName", '') || ' ' ||
              coalesce(notes, '') || ' ' ||
              coalesce("extractedText", '')
            ),
            plainto_tsquery('english', ${q})
          ) DESC
          LIMIT ${limit}
        `,
      )
    } catch {
      // tsquery parse failure — fall back to ILIKE
      results = await prisma.contract.findMany({
        where: {
          organizationId: orgId,
          title: { contains: q, mode: "insensitive" },
          ...(status ? { status } : {}),
        },
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
  orgId: string,
  id: string | number,
): Promise<Response> {
  const parsed = GetContractSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const contract = await prisma.contract.findUnique({
    where: { id: parsed.data.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      tags: true,
      files: {
        where: { isLatest: true },
        select: { id: true, filename: true, mimeType: true, sizeBytes: true, version: true, createdAt: true },
      },
      extractions: {
        select: {
          id: true,
          field: true,
          rawValue: true,
          confidence: true,
          sourceText: true,
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

  if (contract.organizationId !== orgId) {
    return toolError(id, "Error: Contract not found")
  }

  return toolSuccess(id, contract)
}

async function toolCreateContract(
  args: unknown,
  orgId: string,
  userId: string,
  id: string | number,
): Promise<Response> {
  const parsed = CreateContractSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { startDate, endDate, ...rest } = parsed.data

  const contract = await prisma.contract.create({
    data: {
      ...rest,
      owner: { connect: { id: userId } },
      organization: { connect: { id: orgId } },
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    } as any,
    select: { id: true, title: true, status: true },
  })

  await writeActivity(contract.id, userId, "CREATED")

  return toolSuccess(id, contract)
}

async function toolListContracts(
  args: unknown,
  orgId: string,
  id: string | number,
): Promise<Response> {
  const parsed = ListContractsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError(id, `Invalid arguments: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { status, contractType, limit, page } = parsed.data

  const where: Record<string, unknown> = { organizationId: orgId }
  if (status) where.status = status
  if (contractType) where.contractType = contractType

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tags: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contract.count({ where }),
  ])

  return toolSuccess(id, { contracts, total, page, limit })
}

// ---------------------------------------------------------------------------
// Main POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  // Validate JSON-RPC envelope
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
          return toolSearchContracts(toolArgs, ctx.organizationId, id)
        case "get_contract":
          return toolGetContract(toolArgs, ctx.organizationId, id)
        case "create_contract":
          return toolCreateContract(toolArgs, ctx.organizationId, ctx.userId, id)
        case "list_contracts":
          return toolListContracts(toolArgs, ctx.organizationId, id)
        default:
          return toolError(id, `Error: Unknown tool "${toolName}"`)
      }
    }

    // Unknown method
    return jsonRpcError(id, -32601, "Method not found")
  })
}
