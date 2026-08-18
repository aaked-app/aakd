type ActionListRow = {
  id: string
  contractId: string
  kind: string
  title: string
  description: string | null
  condition: string | null
  dueDate: Date | null
  noticeDate: Date | null
  assigneeId: string | null
  sourcePage: number | null
  confidence: number | null
  reviewStatus: string
  status: string
  evidenceRequired: string | null
  acknowledgedAt: Date | null
  completedAt: Date | null
  staleAt: Date | null
  version: number
  createdAt: Date
  updatedAt: Date
  contract: { id: string; title: string; counterpartyName: string | null }
  assignee: { id: string; name: string; email?: string } | null
  sourceText?: string | null
  evidence?: ActionEvidenceRow[]
  _count?: { evidence: number; deliveries: number }
}

type ActionEvidenceRow = {
  id: string
  kind: string
  note: string | null
  sourceUrl: string | null
  recordedById: string
  createdAt: Date
  recordedBy?: { id: string; name: string }
}

type ActionDeliveryRow = {
  id: string
  channel: string
  status: string
  errorCode: string | null
  attemptedAt: Date
  deliveredAt: Date | null
}

type ActionActivityRow = {
  id: string
  action: string
  detail: string | null
  actorLabel: string
  createdAt: Date
  user?: { id: string; name: string } | null
}
type ActionApprovalRow = {
  id: string
  status: string
  required: boolean
  actionVersion: number | null
  step: number
  comment: string | null
  decidedAt: Date | null
  createdAt: Date
  requestedBy: { id: string; name: string }
  assignedTo: { id: string; name: string }
}

type ActionDetailRow = ActionListRow & {
  sourceObligationId?: string | null
  sourceText?: string | null
  evidence: ActionEvidenceRow[]
  deliveries: ActionDeliveryRow[]
  activities?: ActionActivityRow[]
  approvals?: ActionApprovalRow[]
}

export const ACTION_LIST_SELECT = {
  id: true,
  contractId: true,
  kind: true,
  title: true,
  description: true,
  condition: true,
  dueDate: true,
  noticeDate: true,
  assigneeId: true,
  sourcePage: true,
  confidence: true,
  reviewStatus: true,
  status: true,
  evidenceRequired: true,
  acknowledgedAt: true,
  completedAt: true,
  staleAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  contract: { select: { id: true, title: true, counterpartyName: true } },
  assignee: { select: { id: true, name: true } },
  _count: { select: { evidence: true, deliveries: true } },
} as const

export function actionDetailSelect(includeSourceText: boolean) {
  return {
    ...ACTION_LIST_SELECT,
    sourceObligationId: true,
    sourceText: includeSourceText,
    evidence: {
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        kind: true,
        note: true,
        sourceUrl: true,
        recordedById: true,
        createdAt: true,
        recordedBy: { select: { id: true, name: true } },
      },
    },
    deliveries: {
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        channel: true,
        status: true,
        errorCode: true,
        attemptedAt: true,
        deliveredAt: true,
      },
    },
    activities: {
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        action: true,
        detail: true,
        actorLabel: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    },
    approvals: {
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        status: true,
        required: true,
        actionVersion: true,
        step: true,
        comment: true,
        decidedAt: true,
        createdAt: true,
        requestedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    },
  }
}

export function toActionListItem(action: ActionListRow) {
  return {
    id: action.id,
    contractId: action.contractId,
    kind: action.kind,
    title: action.title,
    description: action.description,
    condition: action.condition,
    dueDate: action.dueDate,
    noticeDate: action.noticeDate,
    assigneeId: action.assigneeId,
    sourcePage: action.sourcePage,
    confidence: action.confidence,
    hasCitation: Boolean(action.sourcePage != null || action.sourceText),
    reviewStatus: action.reviewStatus,
    status: action.status,
    evidenceRequired: action.evidenceRequired,
    acknowledgedAt: action.acknowledgedAt,
    completedAt: action.completedAt,
    staleAt: action.staleAt,
    version: action.version,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    contract: action.contract,
    assignee: action.assignee ? { id: action.assignee.id, name: action.assignee.name } : null,
    evidenceCount: action._count?.evidence ?? action.evidence?.length ?? 0,
    deliveryCount: action._count?.deliveries ?? 0,
  }
}

export function toActionDetail(action: ActionDetailRow, includeSourceText: boolean) {
  return {
    ...toActionListItem(action),
    ...(includeSourceText && action.sourceText ? { sourceText: action.sourceText } : {}),
    evidence: action.evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      note: item.note,
      sourceUrl: item.sourceUrl,
      recordedById: item.recordedById,
      recordedBy: item.recordedBy,
      createdAt: item.createdAt,
    })),
    deliveries: action.deliveries.map((item) => ({
      id: item.id,
      channel: item.channel,
      status: item.status,
      errorCode: item.errorCode,
      attemptedAt: item.attemptedAt,
      deliveredAt: item.deliveredAt,
    })),
    activities: (action.activities ?? []).map((item) => ({
      id: item.id,
      action: item.action,
      detail: item.detail,
      actorLabel: item.actorLabel,
      user: item.user,
      createdAt: item.createdAt,
    })),
    approvals: (action.approvals ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      required: item.required,
      actionVersion: item.actionVersion,
      step: item.step,
      comment: item.comment,
      decidedAt: item.decidedAt,
      createdAt: item.createdAt,
      requestedBy: item.requestedBy,
      assignedTo: item.assignedTo,
    })),
  }
}
