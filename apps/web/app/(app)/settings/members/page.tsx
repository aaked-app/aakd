"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { UserPlus, UserMinus, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrgMember } from "@/lib/types"
import { useSession } from "@/lib/auth/client"
import { useLocale, useTranslations } from "next-intl"

const ROLES = ["admin", "legal", "member", "viewer"] as const

const ROLE_RANK: Record<string, number> = {
  owner: 5, admin: 4, legal: 3, member: 2, viewer: 1,
}

interface PendingInvitation {
  id: string
  email: string
  role: string | null
  expiresAt: string
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function RoleBadge({ role, label }: { role: string; label: string }) {
  const colors: Record<string, string> = {
    owner:  "bg-purple-100 text-purple-700",
    admin:  "bg-blue-100 text-blue-700",
    legal:  "bg-amber-100 text-amber-700",
    member: "bg-green-100 text-green-700",
    viewer: "bg-gray-100 text-gray-600",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${colors[role] ?? colors.viewer}`}>
      {label}
    </span>
  )
}

export default function MembersPage() {
  const { data: session } = useSession()
  const t = useTranslations("members")
  const failedToLoadMessage = t("failedToLoad")
  const locale = useLocale()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviting, setInviting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null)
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<{ id: string; email: string } | null>(null)

  const fetchMembers = useCallback(async (signal?: AbortSignal) => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/org/members", { signal }),
        fetch("/api/org/members/invite", { signal }),
      ])
      if (membersRes.ok) {
        const data = await membersRes.json()
        setMembers(data.members ?? data ?? [])
      }
      if (invitesRes.ok) {
        setInvitations(await invitesRes.json())
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      toast.error(failedToLoadMessage)
    } finally {
      setLoading(false)
    }
  }, [failedToLoadMessage])

  useEffect(() => {
    const controller = new AbortController()
    fetchMembers(controller.signal)
    return () => controller.abort()
  }, [fetchMembers])

  const currentMember = members.find((m) => m.userId === session?.user?.id)
  const currentUserRole = currentMember?.role ?? "viewer"
  const myRank = ROLE_RANK[currentUserRole] ?? 0
  const canManageMembers = myRank >= ROLE_RANK.admin
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await fetch("/api/org/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg: Record<string, string> = {
          already_member: "This person is already a member.",
          already_invited: "An active invitation already exists for this email.",
          cannot_invite_higher_role: "You can't invite someone to a higher role than your own.",
        }
        toast.error(msg[body?.error] ?? body?.error ?? "Failed to send invitation")
        return
      }
      toast.success(t("inviteSent", { email: inviteEmail }))
      setInviteEmail("")
      setShowInviteModal(false)
      fetchMembers()
    } catch {
      toast.error(t("failedToInvite"))
    } finally {
      setInviting(false)
    }
  }

  async function changeRole(memberId: string, role: string) {
    try {
      const res = await fetch(`/api/org/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg: Record<string, string> = {
          cannot_demote_last_admin: "Can't change — this is the last admin",
          cannot_demote_last_owner: "Can't change — this is the last owner",
          Forbidden: "Only an owner can change another owner's role",
        }
        toast.error(msg[body?.error] ?? body?.error ?? t("failedToChangeRole"))
        return
      }
      toast.success(t("roleUpdated"))
      fetchMembers()
    } catch {
      toast.error(t("failedToChangeRole"))
    }
  }

  async function removeMember(memberId: string, memberName: string) {
    setConfirmRemove({ id: memberId, name: memberName })
  }

  async function doRemoveMember(memberId: string, memberName: string) {
    setConfirmRemove(null)
    try {
      const res = await fetch(`/api/org/members/${memberId}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? t("failedToRemove"))
        return
      }
      toast.success(t("removed", { name: memberName }))
      fetchMembers()
    } catch {
      toast.error(t("failedToRemove"))
    }
  }

  async function resendInvitation(invitationId: string, email: string) {
    setResendingId(invitationId)
    try {
      const res = await fetch(`/api/org/invitations/${invitationId}`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? t("failedToResend"))
        return
      }
      toast.success(t("inviteResent", { email }))
      fetchMembers()
    } catch {
      toast.error(t("failedToResend"))
    } finally {
      setResendingId(null)
    }
  }

  async function cancelInvitation(invitationId: string, email: string) {
    setConfirmCancelInvite({ id: invitationId, email })
  }

  async function doCancelInvitation(invitationId: string) {
    setConfirmCancelInvite(null)
    try {
      const res = await fetch(`/api/org/invitations/${invitationId}`, { method: "DELETE" })
      if (!res.ok) return
      toast.success(t("inviteCancelled"))
      fetchMembers()
    } catch {
      toast.error(t("failedToCancel"))
    }
  }

  // Can I act on this member? Rank must strictly exceed theirs.
  function canActOn(target: OrgMember): boolean {
    if (target.userId === session?.user?.id) return false
    return myRank > (ROLE_RANK[target.role] ?? 0)
  }

  return (
    <div className="max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 me-2" />
            {t("inviteMember")}
          </Button>
        )}
      </div>

      {/* Active members */}
      <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("tableMember")}</TableHead>
              <TableHead>{t("tableRole")}</TableHead>
              <TableHead>{t("tableStatus")}</TableHead>
              <TableHead>{t("tableJoined")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : members.map((m) => {
              const actable = canActOn(m)
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        {m.user.image && <AvatarImage src={m.user.image} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(m.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{m.user.name}</p>
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManageMembers && actable ? (
                      <><span className="sr-only">{t(`roles.${m.role}.label`)}</span><Select
                        value={m.role}
                        onValueChange={(v) => v != null && changeRole(m.id, v)}
                      >
                        <SelectTrigger aria-label={t("actions.changeRole")} className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{t(`roles.${r}.label`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select></>
                    ) : (
                      <RoleBadge role={m.role} label={t(`roles.${m.role}.label`)} />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-100 text-green-700">
                      {t("active")}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(m.createdAt)}
                  </TableCell>
                  <TableCell>
                    {canManageMembers && actable ? (
                      <Button
                        aria-label={t("actions.removeMember")}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        title="Remove member"
                        onClick={() => removeMember(m.id, m.user.name)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="h-7 w-7" />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {members.map((m) => {
          const actable = canActOn(m)
          return <article key={m.id} className="rounded-md border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{m.user.name}</p><p className="truncate text-sm text-muted-foreground">{m.user.email}</p></div><RoleBadge role={m.role} label={t(`roles.${m.role}.label`)} /></div>
            {canManageMembers && actable && <Select value={m.role} onValueChange={(v) => v != null && changeRole(m.id, v)}>
              <SelectTrigger aria-label={t("actions.changeRole")} className="mt-3 min-h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`roles.${r}.label`)}</SelectItem>)}</SelectContent>
            </Select>}
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{t("tableJoined")}: {formatDate(m.createdAt)}</span>{canManageMembers && actable && <Button aria-label={t("actions.removeMember")} variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => removeMember(m.id, m.user.name)}><UserMinus className="size-4" /></Button>}</div>
          </article>
        })}
      </div>

      {/* Pending invitations */}
      {canManageMembers && invitations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2">
            {t("pendingInvitations")}
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              ({invitations.length})
            </span>
          </h2>
          <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("tableEmail")}</TableHead>
                  <TableHead>{t("tableRole")}</TableHead>
                  <TableHead>{t("tableExpires")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {inv.email[0].toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{inv.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={inv.role ?? "member"} label={t(`roles.${inv.role ?? "member"}.label`)} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(inv.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          aria-label={t("actions.resendInvitation")}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="Resend invitation"
                          disabled={resendingId === inv.id}
                          onClick={() => resendInvitation(inv.id, inv.email)}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${resendingId === inv.id ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          aria-label={t("actions.cancelInvitation")}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          title="Cancel invitation"
                          onClick={() => cancelInvitation(inv.id, inv.email)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">{invitations.map((inv) => <article key={inv.id} className="rounded-md border bg-card p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm">{inv.email}</p><RoleBadge role={inv.role ?? "member"} label={t(`roles.${inv.role ?? "member"}.label`)} /></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-muted-foreground">{t("tableExpires")}: {formatDate(inv.expiresAt)}</span><div className="flex"><Button aria-label={t("actions.resendInvitation")} variant="ghost" size="icon" className="min-h-11 min-w-11" disabled={resendingId === inv.id} onClick={() => resendInvitation(inv.id, inv.email)}><RefreshCw className="size-4" /></Button><Button aria-label={t("actions.cancelInvitation")} variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => cancelInvitation(inv.id, inv.email)}><X className="size-4" /></Button></div></div></article>)}</div>
        </div>
      )}

      {/* Remove member confirmation */}
      <Dialog open={!!confirmRemove} onOpenChange={(open) => { if (!open) setConfirmRemove(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeMemberTitle")}</DialogTitle>
            <DialogDescription>
              {t("removeMemberDesc", { name: confirmRemove?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemove && doRemoveMember(confirmRemove.id, confirmRemove.name)}
            >
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel invitation confirmation */}
      <Dialog open={!!confirmCancelInvite} onOpenChange={(open) => { if (!open) setConfirmCancelInvite(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelInviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("cancelInviteDesc", { email: confirmCancelInvite?.email ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancelInvite(null)}>{t("keepInvite")}</Button>
            <Button
              variant="destructive"
              onClick={() => confirmCancelInvite && doCancelInvitation(confirmCancelInvite.id)}
            >
              {t("cancelInviteAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inviteModalTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={invite} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail" className="text-sm font-medium text-foreground">
                {t("emailAddress")}
              </Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteRole" className="text-sm font-medium text-foreground">
                {t("role")}
              </Label>
              <Select value={inviteRole} onValueChange={(v) => v != null && setInviteRole(v)}>
                <SelectTrigger id="inviteRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex flex-col py-0.5">
                         <span className="font-medium">{t(`roles.${r}.label`)}</span>
                         <span className="text-xs text-muted-foreground">{t(`roles.${r}.description`)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Dynamic role description card */}
               <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                 <p className="text-xs font-semibold text-foreground">{t(`roles.${inviteRole}.label`)}</p>
                 <p className="mt-1 text-xs text-muted-foreground">{t(`roles.${inviteRole}.description`)}</p>
               </div>

              <p className="text-xs text-muted-foreground">
                {t("inviteExpiry")}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? t("sending") : t("sendInvite")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
