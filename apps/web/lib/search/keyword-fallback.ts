import { prisma } from "@/lib/db/client"
import { agreementAccessWhere, type AgreementPrincipal } from "@/lib/auth/agreement-access"

/** Local literal-word fallback. Never sends queries or source text to another provider. */
export async function searchKeywordFallback(ctx: AgreementPrincipal, query: string, limit: number) {
  const words = [...new Set(query.trim().split(/\s+/u).filter(Boolean))].slice(0, 12)
  if (!words.length) return []
  return prisma.contract.findMany({
    where: agreementAccessWhere(ctx, {
      status: { not: "ARCHIVED" },
      AND: words.map(word => ({ OR: [
        { title: { contains: word, mode: "insensitive" as const } },
        { counterpartyName: { contains: word, mode: "insensitive" as const } },
        { extractedText: { contains: word, mode: "insensitive" as const } },
      ] })),
    }),
    select: {
      id: true, title: true, contractType: true, status: true, counterpartyName: true,
      value: true, currency: true, endDate: true, createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(50, limit)),
  })
}
