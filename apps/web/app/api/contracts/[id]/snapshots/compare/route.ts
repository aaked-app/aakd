import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { plateToPlaintext } from "@/lib/editor/plate-to-plaintext"
import { diffLines } from "diff"

// ─── GET /api/contracts/[id]/snapshots/compare?a=snapshotId&b=snapshotId|live ─
// Compare two snapshots (or one snapshot vs the live document).
// Returns a unified diff as structured hunks.

type HunkType = "equal" | "insert" | "delete"

interface Hunk {
  type: HunkType
  lines: string[]
}

interface SnapRef {
  id: string
  label: string
  createdAt: string
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    // Verify contract belongs to this org
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true },
    })
    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const url = new URL(req.url)
    const aId = url.searchParams.get("a")
    const bId = url.searchParams.get("b") ?? "live"

    if (!aId) {
      return Response.json({ error: "Query param 'a' is required" }, { status: 400 })
    }

    // Resolve snapshot A
    const snapA = await prisma.documentSnapshot.findUnique({
      where: { id: aId },
      select: { id: true, label: true, content: true, organizationId: true, contractId: true, createdAt: true },
    })
    if (!snapA || snapA.organizationId !== ctx.organizationId || snapA.contractId !== params.id) {
      return Response.json({ error: "Snapshot A not found" }, { status: 404 })
    }

    // Resolve snapshot B or "live"
    let textB: string
    let refB: SnapRef

    if (bId === "live") {
      const doc = await prisma.contractDocument.findUnique({
        where: { contractId: params.id },
        select: { content: true, updatedAt: true },
      })
      if (!doc) {
        return Response.json({ error: "Live document not found" }, { status: 404 })
      }
      textB = plateToPlaintext(doc.content)
      refB = { id: "live", label: "Current document (live)", createdAt: doc.updatedAt.toISOString() }
    } else {
      const snapB = await prisma.documentSnapshot.findUnique({
        where: { id: bId },
        select: { id: true, label: true, content: true, organizationId: true, contractId: true, createdAt: true },
      })
      if (!snapB || snapB.organizationId !== ctx.organizationId || snapB.contractId !== params.id) {
        return Response.json({ error: "Snapshot B not found" }, { status: 404 })
      }
      textB = plateToPlaintext(snapB.content)
      refB = { id: snapB.id, label: snapB.label, createdAt: snapB.createdAt.toISOString() }
    }

    const textA = plateToPlaintext(snapA.content)

    // Run line diff
    const changes = diffLines(textA, textB)

    const hunks: Hunk[] = changes.map((change) => {
      const type: HunkType = change.added ? "insert" : change.removed ? "delete" : "equal"
      const lines = change.value
        .split("\n")
        .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""))
      return { type, lines }
    })

    return Response.json({
      a: { id: snapA.id, label: snapA.label, createdAt: snapA.createdAt.toISOString() },
      b: refB,
      hunks,
    })
  })
}
