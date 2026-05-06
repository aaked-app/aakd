import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const url = new URL(req.url)
    const contractId = url.searchParams.get("contractId") ?? undefined
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)))
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10))

    const alerts = await prisma.contractAlert.findMany({
      where: {
        contract: { organizationId: ctx.organizationId },
        ...(contractId ? { contractId } : {}),
      },
      include: {
        contract: { select: { id: true, title: true, endDate: true } },
      },
      orderBy: { triggerDate: "asc" },
      take: limit,
      skip: offset,
    })

    return Response.json({ alerts })
  })
}
