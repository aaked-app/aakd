export type ActionApprovalState = "allowed" | "pending" | "rejected"

export function actionApprovalState(
  approvals: readonly { required: boolean; status: string; actionVersion?: number | null }[] | undefined,
  currentVersion: number,
): ActionApprovalState {
  const required = (approvals ?? []).filter((approval) => approval.required)
  if (required.some((approval) => approval.actionVersion === currentVersion && approval.status === "rejected")) return "rejected"
  if (required.some((approval) => approval.actionVersion !== currentVersion || approval.status !== "approved")) return "pending"
  return "allowed"
}
