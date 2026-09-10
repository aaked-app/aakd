import { describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import { AGREEMENT_ACCESS_MODEL_METADATA, scopeAgreementOperation } from "@/lib/auth/agreement-scope"

const ctx = {
  userId: "user-a",
  organizationId: "org-a",
  memberId: "member-a",
  role: "admin",
  source: "session" as const,
  requestId: "request-a",
}

describe("Prisma agreement safety net", () => {
  it("denies scoped operations while the emergency deny-all is active", () => {
    const original = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
    try {
      expect(scopeAgreementOperation("ContractAlert", "findMany", { where: {} }, ctx)).toEqual({
        where: {
          AND: [
            { id: "__agreement_access_denied__" },
            { id: { not: "__agreement_access_denied__" } },
          ],
        },
      })
    } finally {
      if (original === undefined) delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      else process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = original
    }
  })

  it("ANDs a Contract list with the exact member grant", () => {
    expect(scopeAgreementOperation("Contract", "findMany", { where: { status: "ACTIVE" } }, ctx)).toEqual({
      where: {
        status: "ACTIVE",
        AND: [
          { organizationId: "org-a" },
          { accessGrants: { some: { organizationId: "org-a", memberId: "member-a" } } },
        ],
      },
    })
  })

  it("ANDs direct derived records through their contract relationship", () => {
    expect(scopeAgreementOperation("ContractAction", "findUnique", { where: { id: "action-a" } }, ctx)).toEqual({
      where: {
        id: "action-a",
        AND: [
          { organizationId: "org-a" },
          { contract: { accessGrants: { some: { organizationId: "org-a", memberId: "member-a" } } } },
        ],
      },
    })
  })

  it("does not inject a nonexistent organizationId into indirectly scoped alerts", () => {
    expect(scopeAgreementOperation("ContractAlert", "findMany", { where: { status: "PENDING" } }, ctx)).toEqual({
      where: {
        status: "PENDING",
        AND: [
          { contract: { accessGrants: { some: { organizationId: "org-a", memberId: "member-a" } } } },
        ],
      },
    })
  })

  it("keeps every safety-net model and relation path aligned with the generated Prisma DMMF", () => {
    const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]))
    for (const [modelName, metadata] of Object.entries(AGREEMENT_ACCESS_MODEL_METADATA)) {
      let model = models.get(modelName)
      expect(model, `${modelName} must exist`).toBeDefined()
      if (metadata.directOrganizationId) {
        expect(model?.fields.some((field) => field.name === "organizationId"), `${modelName}.organizationId`).toBe(true)
      }
      for (const relationName of metadata.relationPath) {
        const relation = model?.fields.find((field) => field.name === relationName)
        expect(relation?.kind, `${modelName}.${relationName} must be a relation`).toBe("object")
        model = models.get(relation?.type ?? "")
        expect(model, `${modelName}.${relationName} target must exist`).toBeDefined()
      }
      expect(model?.name, `${modelName} access path must end at Contract`).toBe("Contract")
      expect(model?.fields.some((field) => field.name === "accessGrants"), "Contract.accessGrants").toBe(true)
    }
  })

  it("fails closed when a context has no current member identity", () => {
    expect(scopeAgreementOperation("Contract", "count", { where: {} }, { ...ctx, memberId: undefined })).toEqual({
      where: { AND: [{ id: "__agreement_access_denied__" }, { id: { not: "__agreement_access_denied__" } }] },
    })
  })

  it("does not alter create operations or non-agreement models", () => {
    const create = { data: { title: "A" } }
    expect(scopeAgreementOperation("Contract", "create", create, ctx)).toBe(create)
    const unrelated = { where: { id: "tag-a" } }
    expect(scopeAgreementOperation("Tag", "findFirst", unrelated, ctx)).toBe(unrelated)
  })
})
