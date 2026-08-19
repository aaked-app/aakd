import type { Prisma, PrismaClient } from "@prisma/client"
import {
  ActivityAction,
  ContractActionKind,
  ContractActionStatus,
  ContractStatus,
  ContractType,
  ObligationPriority,
  ObligationStatus,
} from "@prisma/client"
import {
  VISUAL_FIXTURE_IDS,
  VISUAL_NO_ORGANIZATION_EMAIL,
  VISUAL_OWNER_EMAIL,
} from "./visual-constants"

export {
  VISUAL_FIXTURE_IDS,
  VISUAL_NO_ORGANIZATION_EMAIL,
  VISUAL_OWNER_EMAIL,
} from "./visual-constants"

type FixtureEnvironment = {
  NODE_ENV?: string
  AAKD_VISUAL_FIXTURE?: string
}

const createdAt = new Date("2026-08-01T09:00:00.000Z")

export function assertVisualFixtureEnabled(env: FixtureEnvironment): void {
  if (env.NODE_ENV === "production") {
    throw new Error("Visual fixtures are forbidden in production")
  }
  if (env.AAKD_VISUAL_FIXTURE !== "1") {
    throw new Error("Visual fixtures require AAKD_VISUAL_FIXTURE=1")
  }
}

export function buildVisualFixtureData(passwordHash: string) {
  const users = [
    {
      id: VISUAL_FIXTURE_IDS.owner,
      name: "E2E Visual Owner",
      email: VISUAL_OWNER_EMAIL,
      emailVerified: true,
      locale: "en",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.legal,
      name: "E2E Visual Legal",
      email: "e2e-visual-legal@example.test",
      emailVerified: true,
      locale: "en",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.viewer,
      name: "E2E Visual Viewer",
      email: "e2e-visual-viewer@example.test",
      emailVerified: true,
      locale: "en",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.noOrganization,
      name: "E2E Visual New User",
      email: VISUAL_NO_ORGANIZATION_EMAIL,
      emailVerified: true,
      locale: "en",
      createdAt,
      updatedAt: createdAt,
    },
  ] satisfies Prisma.UserCreateManyInput[]

  const organization = {
    id: VISUAL_FIXTURE_IDS.organization,
    name: "E2E Visual Workspace",
    slug: "e2e-visual-workspace",
    createdAt,
  } satisfies Prisma.OrganizationCreateInput

  const accounts = [
    {
      id: VISUAL_FIXTURE_IDS.ownerAccount,
      accountId: VISUAL_FIXTURE_IDS.owner,
      providerId: "credential",
      userId: VISUAL_FIXTURE_IDS.owner,
      password: passwordHash,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.noOrganizationAccount,
      accountId: VISUAL_FIXTURE_IDS.noOrganization,
      providerId: "credential",
      userId: VISUAL_FIXTURE_IDS.noOrganization,
      password: passwordHash,
      createdAt,
      updatedAt: createdAt,
    },
  ] satisfies Prisma.AccountCreateManyInput[]

  const members = [
    {
      id: VISUAL_FIXTURE_IDS.ownerMember,
      organizationId: VISUAL_FIXTURE_IDS.organization,
      userId: VISUAL_FIXTURE_IDS.owner,
      role: "owner",
      createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.legalMember,
      organizationId: VISUAL_FIXTURE_IDS.organization,
      userId: VISUAL_FIXTURE_IDS.legal,
      role: "legal",
      createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.viewerMember,
      organizationId: VISUAL_FIXTURE_IDS.organization,
      userId: VISUAL_FIXTURE_IDS.viewer,
      role: "viewer",
      createdAt,
    },
  ] satisfies Prisma.MemberCreateManyInput[]

  const contractRows = [
    ["Northwind Services Agreement", "Northwind Traders", ContractType.MSA, ContractStatus.ACTIVE, "LOW", 180000, "USD", "2027-01-15T12:00:00.000Z"],
    ["Contoso Data Processing Addendum", "Contoso Ltd", ContractType.OTHER, ContractStatus.INTERNAL_REVIEW, "MEDIUM", 72000, "EUR", "2026-10-01T12:00:00.000Z"],
    ["Fabrikam Vendor Agreement", "Fabrikam Inc", ContractType.VENDOR, ContractStatus.PENDING_APPROVAL, "HIGH", 96000, "GBP", "2026-09-12T12:00:00.000Z"],
    ["Adventure Works Statement of Work", "Adventure Works", ContractType.SOW, ContractStatus.ACTIVE, null, 48000, "USD", "2026-12-18T12:00:00.000Z"],
    ["Tailspin Mutual NDA", "Tailspin Toys", ContractType.NDA, ContractStatus.AWAITING_SIGNATURE, "LOW", null, null, "2027-03-01T12:00:00.000Z"],
    ["Woodgrove Customer Agreement", "Woodgrove Bank", ContractType.CUSTOMER, ContractStatus.EXPIRED, "MEDIUM", 240000, "USD", "2026-07-01T12:00:00.000Z"],
  ] as const

  const contracts = contractRows.map((row, index) => ({
    id: VISUAL_FIXTURE_IDS.contracts[index],
    title: row[0],
    counterpartyName: row[1],
    contractType: row[2],
    status: row[3],
    riskScore: row[4],
    value: row[5],
    currency: row[6],
    startDate: new Date("2026-01-15T12:00:00.000Z"),
    endDate: new Date(row[7]),
    renewalDate: new Date(row[7]),
    noticePeriodDays: 30,
    autoRenewal: index < 4,
    ownerId: VISUAL_FIXTURE_IDS.owner,
    organizationId: VISUAL_FIXTURE_IDS.organization,
    createdAt: new Date(`2026-08-0${index + 1}T09:00:00.000Z`),
    updatedAt: new Date(`2026-08-0${index + 1}T09:00:00.000Z`),
  })) satisfies Prisma.ContractCreateManyInput[]

  const obligationRows = [
    [0, "Send non-renewal notice", "Give written notice before the renewal window closes.", "Section 12.2", ObligationPriority.HIGH, ObligationStatus.OVERDUE, "2026-08-12T12:00:00.000Z"],
    [0, "Deliver quarterly service report", "Provide the customer with the agreed performance report.", "Schedule A §4", ObligationPriority.HIGH, ObligationStatus.IN_PROGRESS, "2026-08-25T12:00:00.000Z"],
    [1, "Complete annual security review", "Review the current technical and organizational measures.", "DPA §7", ObligationPriority.HIGH, ObligationStatus.PENDING, "2026-09-10T12:00:00.000Z"],
    [2, "Renew insurance certificate", "Provide evidence of the required coverage.", "Section 9", ObligationPriority.MEDIUM, ObligationStatus.PENDING, "2026-10-05T12:00:00.000Z"],
    [3, "Confirm renewal decision", "Document the owner decision and retain its source evidence.", "Order Form §3", ObligationPriority.MEDIUM, ObligationStatus.COMPLETED, "2026-08-08T12:00:00.000Z"],
  ] as const

  const obligations = obligationRows.map((row, index) => ({
    id: VISUAL_FIXTURE_IDS.obligations[index],
    contractId: VISUAL_FIXTURE_IDS.contracts[row[0]],
    organizationId: VISUAL_FIXTURE_IDS.organization,
    title: row[1],
    description: row[2],
    clauseReference: row[3],
    priority: row[4],
    status: row[5],
    dueDate: new Date(row[6]),
    assigneeId: index === 2 ? VISUAL_FIXTURE_IDS.legal : VISUAL_FIXTURE_IDS.owner,
    completedAt: row[5] === ObligationStatus.COMPLETED ? new Date("2026-08-07T15:00:00.000Z") : null,
    completedById: row[5] === ObligationStatus.COMPLETED ? VISUAL_FIXTURE_IDS.owner : null,
    createdById: VISUAL_FIXTURE_IDS.owner,
    createdAt: new Date(`2026-08-0${index + 1}T10:00:00.000Z`),
    updatedAt: new Date(`2026-08-0${index + 1}T10:00:00.000Z`),
  })) satisfies Prisma.ContractObligationCreateManyInput[]

  const actions = [
    {
      id: VISUAL_FIXTURE_IDS.actions[0],
      organizationId: VISUAL_FIXTURE_IDS.organization,
      contractId: VISUAL_FIXTURE_IDS.contracts[0],
      sourceObligationId: VISUAL_FIXTURE_IDS.obligations[0],
      sourceKey: "visual:obligation:notice",
      kind: ContractActionKind.RENEWAL_NOTICE,
      title: "Send non-renewal notice",
      description: "Prepare and send written notice before the renewal window closes.",
      dueDate: new Date("2026-08-28T12:00:00.000Z"),
      assigneeId: VISUAL_FIXTURE_IDS.owner,
      sourceText: "Either party may terminate by giving at least 30 days' written notice.",
      sourcePage: 12,
      confidence: 0.96,
      sourceHash: "e2e-visual-action-notice-v1",
      reviewStatus: "reviewed",
      status: ContractActionStatus.PROPOSED,
      evidenceRequired: "completion_note",
      createdById: VISUAL_FIXTURE_IDS.owner,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: VISUAL_FIXTURE_IDS.actions[1],
      organizationId: VISUAL_FIXTURE_IDS.organization,
      contractId: VISUAL_FIXTURE_IDS.contracts[1],
      sourceObligationId: VISUAL_FIXTURE_IDS.obligations[2],
      sourceKey: "visual:obligation:security",
      kind: ContractActionKind.OBLIGATION,
      title: "Complete annual security review",
      description: "Review the current technical and organizational measures.",
      dueDate: new Date("2026-09-10T12:00:00.000Z"),
      assigneeId: VISUAL_FIXTURE_IDS.legal,
      sourceText: "The processor shall review its technical measures at least annually.",
      sourcePage: 7,
      confidence: 0.91,
      sourceHash: "e2e-visual-action-security-v1",
      reviewStatus: "reviewed",
      status: ContractActionStatus.ACKNOWLEDGED,
      evidenceRequired: "completion_note",
      acknowledgedAt: createdAt,
      createdById: VISUAL_FIXTURE_IDS.owner,
      createdAt,
      updatedAt: createdAt,
    },
  ] satisfies Prisma.ContractActionCreateManyInput[]

  const activities = VISUAL_FIXTURE_IDS.contracts.map((contractId, index) => ({
    id: VISUAL_FIXTURE_IDS.activities[index],
    contractId,
    userId: VISUAL_FIXTURE_IDS.owner,
    actorLabel: "E2E Visual Owner",
    action: ActivityAction.CREATED,
    detail: "Created for deterministic visual verification",
    createdAt: new Date(`2026-08-0${index + 1}T11:00:00.000Z`),
  })) satisfies Prisma.ActivityCreateManyInput[]

  return { users, organization, accounts, members, contracts, obligations, actions, activities }
}

export async function cleanupVisualFixture(client: PrismaClient | Prisma.TransactionClient) {
  await client.activity.deleteMany({ where: { id: { in: [...VISUAL_FIXTURE_IDS.activities] } } })
  await client.contractAction.deleteMany({ where: { id: { in: [...VISUAL_FIXTURE_IDS.actions] } } })
  await client.contractObligation.deleteMany({ where: { id: { in: [...VISUAL_FIXTURE_IDS.obligations] } } })
  await client.contract.deleteMany({ where: { id: { in: [...VISUAL_FIXTURE_IDS.contracts] } } })
  await client.member.deleteMany({
    where: {
      id: {
        in: [
          VISUAL_FIXTURE_IDS.ownerMember,
          VISUAL_FIXTURE_IDS.legalMember,
          VISUAL_FIXTURE_IDS.viewerMember,
        ],
      },
    },
  })
  await client.account.deleteMany({
    where: { id: { in: [VISUAL_FIXTURE_IDS.ownerAccount, VISUAL_FIXTURE_IDS.noOrganizationAccount] } },
  })
  await client.session.deleteMany({
    where: {
      userId: { in: [VISUAL_FIXTURE_IDS.owner, VISUAL_FIXTURE_IDS.legal, VISUAL_FIXTURE_IDS.viewer, VISUAL_FIXTURE_IDS.noOrganization] },
    },
  })
  await client.organization.deleteMany({ where: { id: VISUAL_FIXTURE_IDS.organization } })
  await client.user.deleteMany({
    where: {
      id: { in: [VISUAL_FIXTURE_IDS.owner, VISUAL_FIXTURE_IDS.legal, VISUAL_FIXTURE_IDS.viewer, VISUAL_FIXTURE_IDS.noOrganization] },
    },
  })
}

export async function seedVisualFixture(client: PrismaClient, passwordHash: string) {
  assertVisualFixtureEnabled(process.env)
  const fixture = buildVisualFixtureData(passwordHash)

  await client.$transaction(async (transaction) => {
    await cleanupVisualFixture(transaction)
    await transaction.user.createMany({ data: fixture.users })
    await transaction.organization.create({ data: fixture.organization })
    await transaction.account.createMany({ data: fixture.accounts })
    await transaction.member.createMany({ data: fixture.members })
    await transaction.contract.createMany({ data: fixture.contracts })
    await transaction.contractObligation.createMany({ data: fixture.obligations })
    await transaction.contractAction.createMany({ data: fixture.actions })
    await transaction.activity.createMany({ data: fixture.activities })
  })

  return fixture
}
