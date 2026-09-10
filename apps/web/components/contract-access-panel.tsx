"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { OrgMember } from "@/lib/types"

type AccessGrant = {
  id: string
  memberId: string
  member: { id: string; role: string; user: { id: string; name: string | null; email: string; image: string | null } }
}

export function ContractAccessPanel({
  contractId,
  ownerId,
  members,
  currentUserId,
  currentRole,
  onOwnerChanged,
}: {
  contractId: string
  ownerId: string
  members: OrgMember[]
  currentUserId?: string
  currentRole?: string
  onOwnerChanged: () => void
}) {
  const t = useTranslations("contract.workspace")
  const canManage = currentUserId === ownerId || currentRole === "owner" || currentRole === "admin"
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [nextOwnerId, setNextOwnerId] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "saving" | "error">("idle")
  const [revokingId, setRevokingId] = useState<string | null>(null)

  async function load() {
    if (!canManage) return
    setState("loading")
    try {
      const response = await fetch(`/api/contracts/${contractId}/access`)
      if (!response.ok) throw new Error("load_failed")
      const body = await response.json() as { grants?: AccessGrant[] }
      setGrants(Array.isArray(body.grants) ? body.grants : [])
      setState("idle")
    } catch {
      setState("error")
    }
  }

  useEffect(() => { void load() }, [canManage, contractId]) // eslint-disable-line react-hooks/exhaustive-deps

  const grantedIds = useMemo(() => new Set(grants.map((grant) => grant.memberId)), [grants])
  const availableMembers = members.filter((member) => !grantedIds.has(member.id))
  const ownerCandidates = members.filter((member) => member.userId !== ownerId)

  if (!canManage) return null

  async function grantAccess() {
    if (!selectedMemberId) return
    setState("saving")
    try {
      const response = await fetch(`/api/contracts/${contractId}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: selectedMemberId }),
      })
      if (!response.ok) throw new Error("grant_failed")
      setSelectedMemberId("")
      await load()
      toast.success(t("accessGranted"))
    } catch {
      setState("error")
      toast.error(t("accessChangeFailed"))
    }
  }

  async function revokeAccess(memberId: string) {
    setRevokingId(memberId)
    try {
      const response = await fetch(`/api/contracts/${contractId}/access/${memberId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("revoke_failed")
      setGrants((current) => current.filter((grant) => grant.memberId !== memberId))
      toast.success(t("accessRevoked"))
    } catch {
      toast.error(t("accessChangeFailed"))
    } finally {
      setRevokingId(null)
    }
  }

  async function transferOwnership() {
    const target = members.find((member) => member.id === nextOwnerId)
    if (!target) return
    setState("saving")
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: target.userId }),
      })
      if (!response.ok) throw new Error("transfer_failed")
      setNextOwnerId("")
      await load()
      onOwnerChanged()
      toast.success(t("ownershipTransferred"))
    } catch {
      setState("error")
      toast.error(t("accessChangeFailed"))
    }
  }

  return (
    <section aria-labelledby="contract-access-heading" className="self-start rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 id="contract-access-heading" className="text-sm font-semibold text-foreground">{t("accessTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("accessDescription")}</p>
        </div>
      </div>

      {state === "loading" ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="size-3.5 animate-spin" />{t("accessLoading")}</p>
      ) : state === "error" ? (
        <div className="mt-4 flex items-center justify-between gap-3" role="alert"><p className="text-xs text-destructive">{t("accessLoadFailed")}</p><Button variant="outline" size="sm" className="min-h-11" onClick={() => void load()}>{t("retry")}</Button></div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {grants.map((grant) => {
              const isOwner = grant.member.user.id === ownerId
              return (
                <div key={grant.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{grant.member.user.name ?? grant.member.user.email}</p><p className="truncate text-xs text-muted-foreground">{isOwner ? t("contractOwner") : grant.member.user.email}</p></div>
                  {!isOwner && <Button variant="ghost" size="sm" className="min-h-11 min-w-11 p-0" disabled={revokingId === grant.memberId} aria-label={t("revokeAccessFor", { name: grant.member.user.name ?? grant.member.user.email })} onClick={() => void revokeAccess(grant.memberId)}>{revokingId === grant.memberId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</Button>}
                </div>
              )
            })}
          </div>

          {availableMembers.length > 0 && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Select value={selectedMemberId} onValueChange={(value) => setSelectedMemberId(value ?? "")}><SelectTrigger className="min-h-11 flex-1" aria-label={t("chooseMember")}><SelectValue placeholder={t("chooseMember")} /></SelectTrigger><SelectContent>{availableMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.user.name ?? member.user.email}</SelectItem>)}</SelectContent></Select><Button className="min-h-11" disabled={!selectedMemberId || state === "saving"} onClick={() => void grantAccess()}><UserPlus className="size-4" />{t("grantAccess")}</Button></div>}

          {ownerCandidates.length > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-semibold text-foreground">{t("transferOwnership")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("transferOwnershipDescription")}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Select value={nextOwnerId} onValueChange={(value) => setNextOwnerId(value ?? "")}><SelectTrigger className="min-h-11 flex-1" aria-label={t("chooseNewOwner")}><SelectValue placeholder={t("chooseNewOwner")} /></SelectTrigger><SelectContent>{ownerCandidates.map((member) => <SelectItem key={member.id} value={member.id}>{member.user.name ?? member.user.email}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="min-h-11" disabled={!nextOwnerId || state === "saving"} onClick={() => void transferOwnership()}>{t("transfer")}</Button></div></div>}
        </>
      )}
    </section>
  )
}
