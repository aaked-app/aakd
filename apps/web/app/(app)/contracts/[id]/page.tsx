"use client"

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/client"
import Link from "next/link"
import { toast } from "sonner"
import {
  ChevronRight,
  ChevronDown,
  Download,
  Archive,
  Upload,
  FileText,
  Check,
  X,
  Plus,
  Bell,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  Send,
  ExternalLink,
  Trash2,
  RefreshCw,
  ArrowUpRight,
  Pen,
  Pencil,
  Loader2,
  User,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/contract-badges"
import { RiskBadge } from "@/components/risk-badge"
import { FileUploadZone } from "@/components/file-upload-zone"
import { RelativeTime } from "@/components/relative-time"
import { ObligationList } from "@/components/obligations/obligation-list"
import type { Obligation } from "@/components/obligations/types"
import { Contract, ContractFile, Activity, ContractStatus, ContractAlert, Tag, Approval, OrgMember, SigningStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AIExtraction {
  id: string
  field: string
  rawValue: string
  confidence: number | null
  sourceText: string
  sourcePage: number | null
  extractedBy: string
  status: "pending" | "accepted" | "rejected"
}

function WorkspaceTabIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}

const ALL_STATUSES: ContractStatus[] = [
  "DRAFT","INTERNAL_REVIEW","PENDING_APPROVAL","AWAITING_SIGNATURE",
  "ACTIVE","EXPIRED","TERMINATED","ARCHIVED",
]
const STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT:               ALL_STATUSES.filter((s) => s !== "DRAFT"),
  INTERNAL_REVIEW:     ALL_STATUSES.filter((s) => s !== "INTERNAL_REVIEW"),
  PENDING_APPROVAL:    ALL_STATUSES.filter((s) => s !== "PENDING_APPROVAL"),
  AWAITING_SIGNATURE:  ALL_STATUSES.filter((s) => s !== "AWAITING_SIGNATURE"),
  ACTIVE:              ALL_STATUSES.filter((s) => s !== "ACTIVE"),
  EXPIRED:             ALL_STATUSES.filter((s) => s !== "EXPIRED"),
  TERMINATED:          ALL_STATUSES.filter((s) => s !== "TERMINATED"),
  ARCHIVED:            ["DRAFT"],
}

// Visual metadata for the status picker — dot color only (labels are translated inside component)
const STATUS_DOT: Record<ContractStatus, string> = {
  DRAFT:               "bg-zinc-400",
  INTERNAL_REVIEW:     "bg-blue-500",
  PENDING_APPROVAL:    "bg-amber-500",
  AWAITING_SIGNATURE:  "bg-violet-500",
  ACTIVE:              "bg-emerald-500",
  EXPIRED:             "bg-red-400",
  TERMINATED:          "bg-red-600",
  ARCHIVED:            "bg-zinc-300",
}

const CONTRACT_TYPES = ["NDA", "MSA", "SOW", "EMPLOYMENT", "VENDOR", "CUSTOMER", "OTHER"] as const
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "OTHER"] as const

const CONTRACT_TAB_VALUES = [
  "overview",
  "documents",
  "ai-extractions",
  "approvals",
  "signing",
  "editor",
  "obligations",
  "risk",
] as const

type ContractTabValue = (typeof CONTRACT_TAB_VALUES)[number]

function isContractTabValue(value: string | null): value is ContractTabValue {
  return CONTRACT_TAB_VALUES.includes(value as ContractTabValue)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SIGNING_STATUS_LABELS: Record<SigningStatus, string> = {
  sent: "Sent",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  failed: "Failed",
}

function SigningStatusBadge({ status }: { status: SigningStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "completed" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        status === "sent" && "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
        status === "declined" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
        status === "expired" && "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
        status === "failed" && "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
      )}
    >
      {SIGNING_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Reviewer Picker ─────────────────────────────────────────────────────────

function ReviewerPicker({
  value,
  members,
  currentUserId,
  onChange,
  chooseReviewerLabel,
  noEligibleReviewersLabel,
}: {
  value: string
  members: OrgMember[]
  currentUserId?: string
  onChange: (id: string) => void
  chooseReviewerLabel: string
  noEligibleReviewersLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const eligible = members.filter((m) => m.userId !== currentUserId)
  const selected = eligible.find((m) => m.userId === value) ?? null

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    return () => document.removeEventListener("pointerdown", onPointer)
  }, [open])

  function initials(m: OrgMember) {
    const name = m.user.name ?? m.user.email
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5 text-sm transition-all",
          open
            ? "border-primary ring-2 ring-primary/20"
            : "border-input hover:border-muted-foreground/40",
        )}
      >
        {selected ? (
          <>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {initials(selected)}
            </div>
            <span className="flex-1 text-start font-medium truncate">
              {selected.user.name ?? selected.user.email}
            </span>
            {selected.user.name && (
              <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                {selected.user.email}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
              <User className="h-3.5 w-3.5 text-muted-foreground/40" />
            </div>
            <span className="flex-1 text-start text-muted-foreground">{chooseReviewerLabel}</span>
          </>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+4px)] inset-x-0 z-[60] bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {eligible.length === 0 ? (
              <p className="px-3 py-4 text-sm text-center text-muted-foreground">
                {noEligibleReviewersLabel}
              </p>
            ) : (
              eligible.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => { onChange(m.userId); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials(m)}
                  </div>
                  <div className="flex-1 text-start min-w-0">
                    <p className="font-medium truncate">{m.user.name ?? m.user.email}</p>
                    {m.user.name && (
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    )}
                  </div>
                  {value === m.userId && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ContractDetailPage() {
  const tStatuses = useTranslations("contract.statuses")
  const tWorkspace = useTranslations("contract.workspace")
  const tActions = useTranslations("actionQueue")
  const locale = useLocale()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const { data: session } = useSession()

  const [contract, setContract] = useState<Contract | null>(null)
  const [files, setFiles] = useState<ContractFile[]>([])
  const [previewFileState, setPreviewFileState] = useState<{ file: ContractFile; url: string } | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [alerts, setAlerts] = useState<ContractAlert[]>([])
  const [extractions, setExtractions] = useState<AIExtraction[]>([])
  const [extractionPolling, setExtractionPolling] = useState(false)
  const [updatingExtractionId, setUpdatingExtractionId] = useState<string | null>(null)
  const [rerunningExtraction, setRerunningExtraction] = useState(false)
  const extractionPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [nextAction, setNextAction] = useState<{ id: string; title: string; status: string; dueDate: string | null } | null>(null)
  const [riskData, setRiskData] = useState<{
    riskScore: string | null
    riskScoredAt: string | null
    riskDetails: Record<string, unknown> | null
  } | null>(null)
  const [analyzingRisk, setAnalyzingRisk] = useState(false)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approvalAssigneeId, setApprovalAssigneeId] = useState("")
  const [approvalMessage, setApprovalMessage] = useState("")
  const [approvalRequired, setApprovalRequired] = useState(true)
  const [requestingApproval, setRequestingApproval] = useState(false)
  const [deciding, setDeciding] = useState<{ id: string; intent: "approve" | "reject" } | null>(null)
  const [decideComment, setDecideComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editOpen, setEditOpen] = useState(searchParams.get("edit") === "true")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Contract>>({})
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagInput, setTagInput] = useState("")
  const [addingTag, setAddingTag] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const formatContractDate = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value))
  const formatContractValue = (value: number, currency: string | null | undefined) => currency
    ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(value)
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)

  function openEdit() {
    setEditForm(contract ?? {})
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditForm(contract ?? {})
  }

  const fetchContract = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError(false)
    try {
      const [contractRes, alertsRes, extractionsRes, approvalsRes, obligationsRes, riskRes, actionsRes] = await Promise.all([
        fetch(`/api/contracts/${id}`, { signal }),
        fetch(`/api/alerts?contractId=${id}`, { signal }),
        fetch(`/api/contracts/${id}/extractions`, { signal }),
        fetch(`/api/contracts/${id}/approvals`, { signal }),
        fetch(`/api/contracts/${id}/obligations`, { signal }),
        fetch(`/api/contracts/${id}/risk-score`, { signal }),
        isActionLedgerUiEnabled()
          ? fetch(`/api/actions?view=dashboard&contractId=${id}&limit=1`, { signal })
          : Promise.resolve(new Response(JSON.stringify({ actions: [] }), { status: 200 })),
      ])
      if (!contractRes.ok) {
        setLoadError(true)
        return
      }
      const data = await contractRes.json()
      setContract(data.contract ?? data)
      setFiles(data.files ?? [])
      setActivities(data.activities ?? [])
      setEditForm(data.contract ?? data)
      if (alertsRes.ok) {
        const alertData = await alertsRes.json()
        setAlerts(alertData.alerts ?? [])
      }
      if (extractionsRes.ok) {
        const extData = await extractionsRes.json()
        setExtractions(extData.extractions ?? [])
      }
      if (approvalsRes.ok) {
        const approvalData = await approvalsRes.json()
        setApprovals(approvalData.approvals ?? [])
      }
      if (obligationsRes.ok) {
        const obligationData = await obligationsRes.json()
        setObligations(obligationData.obligations ?? [])
      }
      if (riskRes.ok) {
        const rd = await riskRes.json()
        setRiskData(rd)
      }
      if (actionsRes.ok) {
        const actionData = await actionsRes.json() as { actions?: Array<{ id: string; title: string; status: string; dueDate: string | null }> }
        setNextAction(Array.isArray(actionData.actions) ? actionData.actions[0] ?? null : null)
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    fetchContract(controller.signal)
    fetch("/api/tags", { signal: controller.signal })
      .then(r => r.json())
      .then(d => setAllTags(Array.isArray(d) ? d : []))
      .catch(() => {})
    fetch("/api/org/members", { signal: controller.signal })
      .then(r => r.json())
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .catch(() => {})
    return () => controller.abort()
  }, [fetchContract])

  // ── AI extraction polling ─────────────────────────────────────────────────
  // When the contract has files but no extractions yet, the BullMQ worker is
  // still running the extract → embed → ai_extract pipeline. Poll every 4 s
  // until data appears (or give up after 90 s).
  useEffect(() => {
    if (loading) return
    if (extractions.length > 0 && contract?.hasExtractedText) {
      // Both metadata rows and source text are ready — kill any active poll.
      // Create-with-review seeds rows before the upload worker finishes, so
      // extractions alone must not stop the text readiness poll.
      if (extractionPollRef.current) {
        clearInterval(extractionPollRef.current)
        extractionPollRef.current = null
      }
      setExtractionPolling(false)
      return
    }
    if (files.length === 0) return // no file uploaded yet — nothing to poll for

    // Start polling
    setExtractionPolling(true)
    let attempts = 0
    const MAX = 22 // 22 × 4 s ≈ 88 s ceiling

    extractionPollRef.current = setInterval(async () => {
      attempts++
      try {
        const [extractionsRes, contractRes] = await Promise.all([
          fetch(`/api/contracts/${id}/extractions`),
          fetch(`/api/contracts/${id}`),
        ])
        if (extractionsRes.ok) {
          const data = await extractionsRes.json()
          if ((data.extractions ?? []).length > 0) setExtractions(data.extractions)
        }
        if (contractRes.ok) {
          const data = await contractRes.json()
          const refreshed = data.contract ?? data
          setContract((current) => current ? { ...current, hasExtractedText: refreshed.hasExtractedText } : current)
        }
      } catch { /* network hiccup — keep polling */ }

      if (attempts >= MAX) {
        clearInterval(extractionPollRef.current!)
        extractionPollRef.current = null
        setExtractionPolling(false)
      }
    }, 4000)

    return () => {
      if (extractionPollRef.current) {
        clearInterval(extractionPollRef.current)
        extractionPollRef.current = null
      }
    }
  }, [loading, extractions.length, files.length, contract?.hasExtractedText, id])

  async function changeStatus(newStatus: ContractStatus) {
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        let msg = "Failed to update status"
        try {
          const body = await res.json()
          if (body?.error) msg = typeof body.error === "string" ? body.error : JSON.stringify(body.error)
        } catch {}
        toast.error(msg)
        console.error("[changeStatus] API error", res.status, newStatus)
        return
      }
      toast.success("Status updated")
      fetchContract()
    } catch (err) {
      console.error("[changeStatus] fetch error", err)
      toast.error("Failed to update status")
    }
  }

  async function saveEdit() {
    if (!editForm.title?.trim()) {
      toast.error("Contract title is required")
      return
    }
    if (editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate) {
      toast.error("End date must be after start date")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Contract updated")
      setEditOpen(false)
      fetchContract()
    } catch {
      toast.error("Failed to update")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", uploadFile)
      const res = await fetch(`/api/contracts/${id}/upload`, { method: "POST", body: fd, credentials: "include" })
      if (!res.ok) throw new Error("Upload failed")
      toast.success("File uploaded")
      setUploadOpen(false)
      setUploadFile(null)
      fetchContract()
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function downloadFile(fileId: string, filename: string) {
    try {
      const res = await fetch(`/api/contracts/${id}/upload?fileId=${fileId}`)
      if (!res.ok) throw new Error("Download failed")
      const { url } = await res.json()
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
    } catch {
      toast.error("Download failed")
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("Delete this file? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/contracts/${id}/upload?fileId=${fileId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      toast.success("File deleted")
      fetchContract()
    } catch {
      toast.error("Failed to delete file")
    }
  }

  async function previewFile(file: ContractFile) {
    try {
      const res = await fetch(`/api/contracts/${id}/upload?fileId=${file.id}`)
      if (!res.ok) throw new Error("Preview failed")
      const { url } = await res.json()
      setPreviewFileState({ file, url })
    } catch {
      toast.error("Failed to open preview")
    }
  }

  async function deleteContract() {
    setArchiving(true)
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("Contract archived")
      router.push("/contracts")
    } catch {
      toast.error("Failed to archive contract")
      setArchiving(false)
    }
    setArchiveOpen(false)
  }

  async function handleExtraction(extractionId: string, action: "accept" | "reject") {
    if (updatingExtractionId) return
    setUpdatingExtractionId(extractionId)
    try {
      const res = await fetch(`/api/contracts/${id}/extractions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, extractionId }),
      })
      if (!res.ok) {
        toast.error("Failed to update extraction")
        return
      }
      setExtractions((prev) =>
        prev.map((e) =>
          e.id === extractionId
            ? { ...e, status: action === "accept" ? "accepted" : "rejected" }
            : e,
        ),
      )
    } catch {
      toast.error("Failed to update extraction")
    } finally {
      setUpdatingExtractionId(null)
    }
  }

  async function handleRerunExtraction() {
    if (rerunningExtraction) return
    setRerunningExtraction(true)
    try {
      const res = await fetch(`/api/contracts/${id}/extractions/rerun`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.message ?? "Failed to re-run extraction")
        return
      }
      toast.success("AI extraction queued — results will appear in ~30s")
      // Reset polling so the tab auto-refreshes when new results land
      setExtractions([])
    } catch {
      toast.error("Failed to re-run extraction")
    } finally {
      setRerunningExtraction(false)
    }
  }

  async function removeTag(tagId: string) {
    if (!contract) return
    const newTagIds = (contract.tags ?? []).filter(t => t.id !== tagId).map(t => t.id)
    setContract(c => c ? { ...c, tags: (c.tags ?? []).filter(t => t.id !== tagId) } : c)
    try {
      await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      })
    } catch {
      fetchContract()
    }
  }

  async function addTag(tagId: string) {
    if (!contract) return
    const existing = contract.tags ?? []
    if (existing.some(t => t.id === tagId)) return
    const tag = allTags.find(t => t.id === tagId)
    if (!tag) return
    const newTagIds = [...existing.map(t => t.id), tagId]
    setContract(c => c ? { ...c, tags: [...(c.tags ?? []), tag] } : c)
    setTagInput("")
    setAddingTag(false)
    try {
      await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      })
    } catch {
      fetchContract()
    }
  }

  async function createAndAddTag(name: string) {
    if (!name.trim() || !contract) return
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) return
      const newTag = await res.json()
      setAllTags(prev => [...prev, newTag])
      const existing = contract.tags ?? []
      const newTagIds = [...existing.map(t => t.id), newTag.id]
      setContract(c => c ? { ...c, tags: [...(c.tags ?? []), newTag] } : c)
      setTagInput("")
      setAddingTag(false)
      await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      })
    } catch {
      fetchContract()
    }
  }

  async function requestApproval() {
    if (!approvalAssigneeId) return
    setRequestingApproval(true)
    try {
      const res = await fetch(`/api/contracts/${id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: approvalAssigneeId, message: approvalMessage || undefined, required: approvalRequired }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Approval requested")
      setApprovalOpen(false)
      setApprovalAssigneeId("")
      setApprovalMessage("")
      setApprovalRequired(true)
      fetchContract()
    } catch {
      toast.error("Failed to request approval")
    } finally {
      setRequestingApproval(false)
    }
  }

  async function cancelApproval(approvalId: string) {
    try {
      const res = await fetch(`/api/contracts/${id}/approvals/${approvalId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Approval request cancelled")
      fetchContract()
    } catch {
      toast.error("Failed to cancel approval request")
    }
  }

  async function decideApproval(approvalId: string, decision: "approved" | "rejected", comment?: string) {
    try {
      const res = await fetch(`/api/contracts/${id}/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(decision === "approved" ? "Approved" : "Rejected")
      setDeciding(null)
      setDecideComment("")
      fetchContract()
    } catch {
      toast.error("Failed to submit decision")
    }
  }

  async function analyzeRisk() {
    setAnalyzingRisk(true)
    try {
      const res = await fetch(`/api/contracts/${id}/risk-score`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? "Failed to analyze risk")
        return
      }
      const queued = await res.json()
      if (res.status !== 202 || !queued.jobId) {
        setRiskData(queued)
        toast.success("Risk analysis complete")
        return
      }

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const poll = await fetch(`/api/contracts/${id}/risk-score?jobId=${encodeURIComponent(queued.jobId)}`)
        const result = await poll.json().catch(() => ({}))
        if (result.state === "completed") {
          setRiskData(result)
          toast.success("Risk analysis complete")
          return
        }
        if (result.state === "failed" || result.state === "not_found") {
          throw new Error(result.reason ?? "Risk analysis failed")
        }
      }
      throw new Error("Risk analysis timed out")
    } catch {
      toast.error("Failed to analyze risk")
    } finally {
      setAnalyzingRisk(false)
    }
  }

  function sendForSignature() {
    router.push(`/contracts/${id}/signing`)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-32" />
        <div className="mt-6 grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6" aria-labelledby="contract-load-error-title">
        <section role="alert" className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <AlertCircle className="mb-4 size-5 text-muted-foreground" aria-hidden="true" />
          <h1 id="contract-load-error-title" className="text-lg font-semibold text-foreground">{tWorkspace("loadFailed")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{tWorkspace("loadFailedDescription")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" className="min-h-11" onClick={() => void fetchContract()}>
              <RefreshCw className="size-4" />
              {tWorkspace("retry")}
            </Button>
            <Link
              href="/contracts"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {tWorkspace("backToContracts")}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (!contract) return null

  const transitions = STATUS_TRANSITIONS[contract.status] ?? []
  const pendingExtractions = extractions.filter((e) => e.status === "pending")
  const pendingApprovals = approvals.filter((a) => a.status === "pending")
  const assignedPendingApproval = pendingApprovals.find((approval) => approval.assignedToId === session?.user?.id)
  const activeObligations = obligations.filter(
    (o) => o.status === "PENDING" || o.status === "IN_PROGRESS",
  )
  const signingEnabled = process.env.NEXT_PUBLIC_SIGNING_ENABLED === "true"
  const canSendForSignature =
    signingEnabled &&
    contract.status === "AWAITING_SIGNATURE" &&
    (!contract.signingStatus || ["declined", "expired", "failed"].includes(contract.signingStatus))

  // Determine if current user can request approvals (admin or legal in this org)
  const currentMember = members.find((m) => m.userId === session?.user?.id)
  const APPROVAL_REQUESTABLE_STATUSES: ContractStatus[] = ["DRAFT", "INTERNAL_REVIEW", "PENDING_APPROVAL"]
  const canRequestApproval =
    (currentMember?.role === "admin" || currentMember?.role === "legal" || currentMember?.role === "owner") &&
    APPROVAL_REQUESTABLE_STATUSES.includes(contract.status)
  const isAdminOrOwner = currentMember?.role === "admin" || currentMember?.role === "owner"
  const canManage = currentMember?.role === "admin" || currentMember?.role === "legal" || currentMember?.role === "owner"
  const canAnalyzeRisk = canManage
  const requestedTab = searchParams.get("tab")
  const initialTab =
    isContractTabValue(requestedTab) && (requestedTab !== "signing" || signingEnabled)
      ? requestedTab
      : "overview"
  const primaryWorkspaceAction = assignedPendingApproval
    ? { href: `/contracts/${id}?tab=approvals`, label: tWorkspace("reviewApproval"), detail: tWorkspace("pendingApproval") }
    : pendingExtractions.length > 0
    ? { href: `/contracts/${id}?tab=ai-extractions`, label: tWorkspace("reviewSuggestions"), detail: tWorkspace("pendingSuggestions", { count: pendingExtractions.length }) }
    : isActionLedgerUiEnabled() && nextAction
      ? { href: `/actions/${nextAction.id}`, label: tActions("openAction"), detail: nextAction.title }
      : null
  const workflowReadiness = [
    {
      tab: tWorkspace("files"),
      detail: files.length > 0 ? tWorkspace("fileCount", { count: files.length }) : tWorkspace("noFiles"),
      href: `/contracts/${id}?tab=documents`,
    },
    {
      tab: tWorkspace("review"),
      detail: pendingExtractions.length > 0
        ? tWorkspace("pendingSuggestions", { count: pendingExtractions.length })
        : tWorkspace("allSuggestionsReviewed"),
      href: `/contracts/${id}?tab=ai-extractions`,
    },
    {
      tab: tWorkspace("approvals"),
      detail: pendingApprovals.length > 0
        ? tWorkspace("pendingApprovalsCount", { count: pendingApprovals.length })
        : tWorkspace("noApprovals"),
      href: `/contracts/${id}?tab=approvals`,
    },
    {
      tab: tWorkspace("actionsTab"),
      detail: activeObligations.length > 0
        ? tWorkspace("activeActions", { count: activeObligations.length })
        : tWorkspace("noActiveActions"),
      href: `/contracts/${id}?tab=obligations`,
    },
    {
      tab: tWorkspace("risk"),
      detail: riskData?.riskScore ? tWorkspace("riskAnalysisAvailable") : tWorkspace("noRiskAnalysis"),
      href: `/contracts/${id}?tab=risk`,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/[0.18]">
      {/* ── Header section ── */}
      <header className="flex-shrink-0 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6 xl:px-8">
        <div className="mx-auto w-full max-w-[1440px]">
        {/* Row 1 — Breadcrumb */}
        <nav aria-label={tWorkspace("breadcrumb")} className="mb-3 flex min-w-0 items-center gap-1.5">
          <Link
            href="/contracts"
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {tWorkspace("contracts")}
          </Link>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground rtl:rotate-180" />
          <span className="truncate text-xs text-muted-foreground">{contract.title}</span>
        </nav>

        {/* Row 2 — Title + actions */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{contract.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={contract.status} />
            {riskData?.riskScore && <RiskBadge level={riskData.riskScore} />}
            {contract.counterpartyName && <span className="text-sm text-muted-foreground">{contract.counterpartyName}</span>}
            {contract.contractType && <span className="text-sm text-muted-foreground before:me-2 before:text-border before:content-['·']">{contract.contractType}</span>}
            </div>
          </div>
          <div
            role="group"
            aria-label={tWorkspace("actions")}
            className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end"
          >
            {transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:flex-none">
                  <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT[contract.status] ?? "bg-zinc-400")} />
                  {tWorkspace("changeStatus")}
                  <ChevronDown className="size-3 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5">
                  <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tWorkspace("moveTo")}
                  </div>
                  <DropdownMenuSeparator className="my-1" />
                  {transitions.map((s) => {
                    const dot = STATUS_DOT[s] ?? "bg-zinc-400"
                    return (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => changeStatus(s)}
                        className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] px-2.5 py-2.5 cursor-pointer"
                      >
                        <span className={cn("mt-[3px] size-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background", dot, dot.replace("bg-", "ring-"))} />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[13px] font-medium leading-none">{tStatuses(s)}</span>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canRequestApproval && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalOpen(true)}
                className="min-h-11 flex-1 sm:flex-none"
              >
                <ArrowUpRight className="size-3.5" />
                {tWorkspace("sendForApproval")}
              </Button>
            )}
            {canSendForSignature && (
              <Button
                size="sm"
                onClick={sendForSignature}
                className="min-h-11 flex-1 sm:flex-none"
              >
                <Pen className="size-3.5" />
                {tWorkspace("sendForSigning")}
              </Button>
            )}
            {canManage && contract.status !== "ARCHIVED" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArchiveOpen(true)}
                className="min-h-11 flex-1 sm:flex-none"
              >
                <Archive className="size-3.5" />
                {tWorkspace("archive")}
              </Button>
            )}
          </div>
        </div>
        </div>
      </header>

      {primaryWorkspaceAction ? <section className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-[1392px] flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-3.5 sm:w-[calc(100%-3rem)] xl:w-[calc(100%-4rem)]" aria-label={tActions("nextStep")}><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tActions("nextStep")}</p><p className="mt-1 truncate text-sm font-semibold text-foreground">{primaryWorkspaceAction.detail}</p></div><Link href={primaryWorkspaceAction.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{primaryWorkspaceAction.label}<ArrowUpRight className="ms-1 size-3.5 rtl:-scale-x-100" /></Link></section> : null}

      {/* ── Tab bar ── */}
      <Tabs
        defaultValue={initialTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList
          aria-label={tWorkspace("tabs")}
          className="h-auto w-full flex-shrink-0 justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-background px-4 p-0 sm:px-6 xl:px-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <TabsTrigger
            value="overview"
            className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
          >
            {tWorkspace("summary")}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
          >
            {tWorkspace("files")}{files.length > 0 && ` (${files.length})`}
          </TabsTrigger>
          <TabsTrigger
            value="ai-extractions"
            className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
          >
            {tWorkspace("review")}
            {pendingExtractions.length > 0 && (
              <span className="ms-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                {pendingExtractions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="approvals"
            className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
          >
            {tWorkspace("approvals")}
            {pendingApprovals.length > 0 && (
              <span className="ms-1.5 rounded-full bg-amber-600 px-1.5 py-0.5 text-xs font-medium text-white">
                {pendingApprovals.length}
              </span>
            )}
          </TabsTrigger>
          {signingEnabled && (
            <TabsTrigger
              value="signing"
              className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
            >
              {tWorkspace("signing")}
            </TabsTrigger>
          )}
          {/* The editor remains available for existing deep links, but is hidden
              from the primary workflow until authoring is production-ready. */}
          <TabsTrigger
            value="obligations"
            className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
          >
            {tWorkspace("actionsTab")}
            {activeObligations.length > 0 && (
              <span className="ms-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                {activeObligations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="risk"
            className="-mb-px flex-none rounded-none border-b-2 border-transparent px-3.5 py-3 text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:shadow-none"
          >
            {tWorkspace("risk")}
            {riskData?.riskScore === "HIGH" && (
              <span className="ms-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white">
                !
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="editor" className="sr-only">
            {tWorkspace("editor")}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab content area ── */}

        {/* Overview — 2-column grid */}
        <TabsContent value="overview" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("summaryEyebrow")}
              title={tWorkspace("summaryTitle")}
              description={tWorkspace("summaryDescription")}
            />
            <section aria-labelledby="workflow-readiness-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-4">
                <h2 id="workflow-readiness-heading" className="text-sm font-semibold text-foreground">
                  {tWorkspace("workflowReadiness")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{tWorkspace("workflowReadinessDescription")}</p>
              </div>
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
                {workflowReadiness.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={tWorkspace("openTab", { tab: item.tab })}
                    className="min-h-20 bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
                  >
                    <p className="text-xs font-medium text-foreground">{item.tab}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </Link>
                ))}
              </div>
            </section>
            <div
              data-testid="contract-overview-layout"
              className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"
            >
            {/* LEFT column */}
            <div className="flex flex-col gap-4">
              {/* Card A — Contract Details */}
              <section aria-labelledby="contract-details-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <h2 id="contract-details-heading" className="text-sm font-semibold">{tWorkspace("details")}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={openEdit}
                    title={tWorkspace("editContract")}
                    aria-label={tWorkspace("editContract")}
                  >
                    <Pencil style={{ width: 14, height: 14 }} />
                  </Button>
                </div>
                <div data-testid="contract-detail-grid" className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {contract.counterpartyName && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("counterparty")}</p>
                      <p className="text-[13px] font-medium">{contract.counterpartyName}</p>
                    </div>
                  )}
                  {contract.value != null && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("contractValue")}</p>
                      <p className="text-[13px] font-medium">{formatContractValue(contract.value, contract.currency)}</p>
                    </div>
                  )}
                  {contract.startDate && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("startDate")}</p>
                      <p className="text-[13px] font-medium">{formatContractDate(contract.startDate)}</p>
                    </div>
                  )}
                  {contract.endDate && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("endDate")}</p>
                      <p className="text-[13px] font-medium">{formatContractDate(contract.endDate)}</p>
                    </div>
                  )}
                  {contract.owner?.name && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("owner")}</p>
                      <p className="text-[13px] font-medium">{contract.owner.name}</p>
                    </div>
                  )}
                  {contract.contractType && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("type")}</p>
                      <p className="text-[13px] font-medium">{contract.contractType}</p>
                    </div>
                  )}
                  {contract.governingLaw && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("governingLaw")}</p>
                      <p className="text-[13px] font-medium">{contract.governingLaw}</p>
                    </div>
                  )}
                  {contract.noticePeriodDays != null && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("noticePeriod")}</p>
                      <p className="text-[13px] font-medium">{contract.noticePeriodDays} {tWorkspace("days")}</p>
                    </div>
                  )}
                  {contract.folder?.name && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{tWorkspace("folder")}</p>
                      <p className="text-[13px] font-medium">{contract.folder.name}</p>
                    </div>
                  )}
                </div>
                {/* Tags row */}
                {((contract.tags ?? []).length > 0 || true) && (
                  <div className="mt-3.5 flex flex-wrap gap-1.5 items-center">
                    {(contract.tags ?? []).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => removeTag(tag.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={tWorkspace("removeTag", { tag: tag.name })}
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                    {addingTag ? (
                      <div className="relative">
                        <Input
                          autoFocus
                          className="h-6 w-28 text-xs px-2"
                          placeholder={tWorkspace("tagNamePlaceholder")}
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              const match = allTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase())
                              if (match) addTag(match.id)
                              else if (tagInput.trim()) createAndAddTag(tagInput)
                            }
                            if (e.key === "Escape") { setAddingTag(false); setTagInput("") }
                          }}
                          onBlur={() => { if (!tagInput.trim()) { setAddingTag(false) } }}
                        />
                        {tagInput && (
                          <div className="absolute start-0 top-full z-10 mt-1 w-40 rounded-md border border-border bg-card shadow-md">
                            {allTags
                              .filter(t =>
                                t.name.toLowerCase().includes(tagInput.toLowerCase()) &&
                                !(contract.tags ?? []).some(ct => ct.id === t.id)
                              )
                              .slice(0, 5)
                              .map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); addTag(t.id) }}
                                className="w-full px-3 py-1.5 text-start text-xs hover:bg-muted-foreground/[0.08]"
                                >
                                  {t.name}
                                </button>
                              ))
                            }
                            {!allTags.some(t => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                              <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); createAndAddTag(tagInput) }}
                                className="w-full px-3 py-1.5 text-start text-xs text-muted-foreground hover:bg-muted-foreground/[0.08]"
                              >
                                + Create &quot;{tagInput}&quot;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingTag(true)}
                        className="inline-flex items-center gap-0.5 rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      >
                        <Plus className="size-2.5" />
                        {tWorkspace("addTag")}
                      </button>
                    )}
                  </div>
                )}
                {/* Alerts */}
                {alerts.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-border">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      <Bell className="size-3" />
                      Renewal Alerts
                    </p>
                    <div className="space-y-1.5">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm"
                        >
                          <span className="text-foreground text-[12px]">
                            {alert.alertType.replace(/_/g, " ")}
                          </span>
                          <span className={cn(
                            "text-[11px]",
                            alert.firedAt ? "text-muted-foreground" : "text-amber-600"
                          )}>
                            {alert.firedAt ? "Fired" : formatContractDate(alert.triggerDate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Notes */}
                {contract.notes && (
                  <div className="mt-3.5 pt-3.5 border-t border-border">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tWorkspace("notes")}</p>
                    <p className="whitespace-pre-wrap text-[13px] text-foreground">{contract.notes}</p>
                  </div>
                )}
              </section>

              {/* Signing status */}
              <div className="p-[18px_20px] rounded-[var(--radius)] border border-border bg-card">
                <p className="mb-2.5 text-[13px] font-semibold">{tWorkspace("signingStatus")}</p>
                {contract.signingStatus ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">DocuSeal</span>
                    <SigningStatusBadge status={contract.signingStatus} />
                    {contract.signingUrl && contract.signingStatus === "sent" && (
                      <a
                        href={contract.signingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {tWorkspace("openSigningLink")} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-[13px] text-muted-foreground">{tWorkspace("noSigningConfigured")}</p>
                    {canSendForSignature && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={sendForSignature}
                      >
                        <Pen className="size-3.5" />
                        {tWorkspace("sendForSigning")}
                      </Button>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT column — Activity panel */}
            <section aria-labelledby="contract-activity-heading" className="self-start rounded-xl border border-border bg-card p-4 sm:p-5">
              <h2 id="contract-activity-heading" className="mb-3.5 text-sm font-semibold">{tWorkspace("activity")}</h2>
              {activities.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">{tWorkspace("noActivity")}</p>
              ) : (
                <div className="space-y-0 max-h-[420px] overflow-y-auto pe-1">
                  {activities.map((activity, idx) => {
                    const isLast = idx === activities.length - 1
                    return (
                      <div key={activity.id} className="flex gap-2.5 py-2 relative">
                        {/* Connector line */}
                        {!isLast && (
                          <div className="absolute start-[11px] top-8 bottom-0 w-px bg-border" />
                        )}
                        {/* Icon circle */}
                        <div className="w-[22px] h-[22px] rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] font-semibold z-10">
                          {(activity.user?.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px]">
                            <span className="font-semibold">{activity.user?.name ?? "System"}</span>
                            {" "}
                            <span className="text-muted-foreground">{activity.action.replace(/_/g, " ").toLowerCase()}</span>
                          </p>
                          <p className="text-[10.5px] text-muted-foreground mt-0.5">
                            <RelativeTime date={activity.createdAt} />
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
            </div>
          </div>
        </TabsContent>

        {/* Files */}
        <TabsContent value="documents" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("filesEyebrow")}
              title={tWorkspace("filesTitle")}
              description={tWorkspace("filesDescription")}
              action={
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => setUploadOpen(true)}>
                  <Upload className="size-4" />
                  {tWorkspace("uploadFile")}
                </Button>
              }
            />
            <div className="rounded-[var(--radius)] border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">{tWorkspace("fileVersions")}</h3>
              </div>
              {files.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{tWorkspace("noFiles")}</p>
                  <p className="max-w-sm text-center text-xs leading-5 text-muted-foreground">{tWorkspace("noFilesDescription")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => {
                    const ext = f.filename.split(".").pop()?.toUpperCase() ?? "FILE"
                    const isPdf = ext === "PDF"
                    const isDocx = ext === "DOCX"
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-3"
                      >
                        <div
                          className={cn(
                            "flex h-9 w-14 shrink-0 items-center justify-center rounded text-xs font-bold",
                            isPdf && "bg-red-100 text-red-700",
                            isDocx && "bg-blue-100 text-blue-700",
                            !isPdf && !isDocx && "bg-emerald-100 text-emerald-700",
                          )}
                        >
                          {ext}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="truncate text-sm font-medium text-foreground">{f.filename}</p>
                            {f.isLatest && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                {tWorkspace("currentVersion")}
                              </span>
                            )}
                            {!f.isLatest && f.version && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                v{f.version}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatBytes(f.sizeBytes)} · Uploaded{" "}
                            <RelativeTime date={f.createdAt} />
                            {f.uploadedBy && (
                              <span> by {f.uploadedBy.name.charAt(0).toUpperCase()}{f.uploadedBy.name.split(" ")[1]?.charAt(0).toUpperCase() ?? ""}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 min-w-11 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => previewFile(f)}
                            title={tWorkspace("previewFile")}
                            aria-label={tWorkspace("previewFile")}
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 min-w-11 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => downloadFile(f.id, f.filename)}
                            title={tWorkspace("downloadFile")}
                            aria-label={tWorkspace("downloadFile")}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 min-w-11 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteFile(f.id)}
                            title={tWorkspace("deleteFile")}
                            aria-label={tWorkspace("deleteFile")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* AI Extractions */}
        <TabsContent value="ai-extractions" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("reviewEyebrow")}
              title={tWorkspace("reviewTitle")}
              description={tWorkspace("reviewDescription")}
              action={
                <Button size="sm" variant="outline" className="min-h-11" onClick={handleRerunExtraction} disabled={rerunningExtraction}>
                  <RefreshCw className={cn("size-3.5", rerunningExtraction && "animate-spin")} />
                  {rerunningExtraction ? tWorkspace("rerunningExtraction") : tWorkspace("rerunExtraction")}
                </Button>
              }
            />
            {extractions.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-border bg-card p-5">
                {extractionPolling ? (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      {tWorkspace("extractionInProgress")}
                    </p>
                    <p className="text-xs text-muted-foreground/60 text-center">
                      {tWorkspace("extractionInProgressDescription")}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {tWorkspace("noExtractions")}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{tWorkspace("reviewSuggestions")}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pendingExtractions.length > 0
                        ? tWorkspace("pendingSuggestions", { count: pendingExtractions.length })
                        : tWorkspace("allSuggestionsReviewed")}
                    </p>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                      {tWorkspace("reviewGuidance")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {extractions.map((e) => {
                    const accepted = e.status === "accepted"
                    const rejected = e.status === "rejected"
                    const confidencePct = e.confidence == null ? null : Math.round(e.confidence * 100)
                    return (
                      <div
                        key={e.id}
                        className={cn(
                          "rounded-[var(--radius)] border border-border bg-card p-4",
                          (accepted || rejected) && "opacity-60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{e.field}</p>
                          {confidencePct == null ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shrink-0">
                              {tWorkspace("manual")}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                                confidencePct >= 90
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700",
                              )}
                            >
                              {confidencePct}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-3 min-h-[1.25rem]">
                          {e.rawValue ?? "—"}
                        </p>
                        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {e.extractedBy === "manual" || e.extractedBy === "user"
                            ? tWorkspace("manualEntry")
                            : e.extractedBy === "local" ? tWorkspace("localExtraction") : tWorkspace("aiAssistedSuggestion")}
                        </p>
                        {e.sourceText && (
                          <blockquote className="mb-3 border-s-2 border-border ps-3 text-xs italic text-muted-foreground">
                            <p>{e.sourceText}</p>
                            {e.sourcePage != null && (
                              <cite className="mt-1 block text-[10px] not-italic text-muted-foreground">
                                {tWorkspace("sourcePage", { page: e.sourcePage })}
                              </cite>
                            )}
                          </blockquote>
                        )}
                        {!accepted && !rejected && (
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                            className="min-h-11 text-xs flex-1"
                              onClick={() => handleExtraction(e.id, "accept")}
                              disabled={updatingExtractionId !== null}
                            >
                              {updatingExtractionId === e.id ? tWorkspace("saving") : tWorkspace("accept")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                            className="min-h-11 text-xs flex-1"
                              onClick={() => handleExtraction(e.id, "reject")}
                              disabled={updatingExtractionId !== null}
                            >
                              {tWorkspace("reject")}
                            </Button>
                          </div>
                        )}
                        {accepted && (
                          <div className="flex items-center gap-1 text-xs text-emerald-600">
                            <Check className="size-3" />
                            {tWorkspace("accepted")}
                          </div>
                        )}
                        {rejected && (
                          <span className="text-xs text-muted-foreground">{tWorkspace("rejected")}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Approvals */}
        <TabsContent value="approvals" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("approvalsEyebrow")}
              title={tWorkspace("approvalsTitle")}
              description={tWorkspace("approvalsDescription")}
              action={canRequestApproval ? (
                <Button size="sm" className="min-h-11" onClick={() => setApprovalOpen(true)}>
                  <UserCheck className="size-4" />
                  {tWorkspace("requestApproval")}
                </Button>
              ) : undefined}
            />
            <div className="rounded-[var(--radius)] border border-border bg-card p-5">
              {approvals.some(a => a.status === "rejected") && (() => {
                const iWasTheReviewer = approvals.some(a => a.status === "rejected" && a.assignedToId === session?.user?.id)
                if (iWasTheReviewer) return (
                  <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-zinc-200 bg-muted/60 px-4 py-3">
                    <AlertCircle className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-zinc-600">{tWorkspace("approvalRejectedByYou")}</p>
                  </div>
                )
                return (
                  <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900">{tWorkspace("approvalRejected")}</p>
                      <p className="text-xs text-amber-700 mt-0.5">{tWorkspace("approvalRejectedDescription")}</p>
                    </div>
                    {canRequestApproval && (
                      <Button size="sm" onClick={() => setApprovalOpen(true)} className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0">
                        {tWorkspace("resubmitApproval")}
                      </Button>
                    )}
                  </div>
                )
              })()}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-medium text-foreground">{tWorkspace("approvalSteps")}</h3>
              </div>

              {approvals.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">{tWorkspace("noApprovalRequests")}</p>
                  {!canRequestApproval && currentMember && (() => {
                    const roleAllowed = ["admin", "legal", "owner"].includes(currentMember.role)
                    return (
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {roleAllowed
                          ? `Approvals cannot be requested while the contract is ${contract.status.replace(/_/g, " ").toLowerCase()}.`
                          : `Your role (${currentMember.role}) cannot request approvals. Legal, Admin, or Owner role required.`}
                      </p>
                    )
                  })()}
                </div>
              ) : (
                <div className="relative">
                  {approvals.map((approval, idx) => {
                    const isPending = approval.status === "pending"
                    const isDone = approval.status === "approved"
                    const isWaiting = approval.status === "waiting"
                    const isMyApproval = approval.assignedToId === session?.user?.id && isPending
                    const isDeciding = deciding?.id === approval.id
                    const isLast = idx === approvals.length - 1

                    return (
                      <div key={approval.id} className="relative flex gap-4">
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full text-xs font-semibold z-10",
                              isDone && "bg-emerald-100 text-emerald-700",
                              isPending && "bg-amber-100 text-amber-700",
                              !isDone && !isPending && "bg-muted text-muted-foreground",
                            )}
                          >
                            {isDone ? (
                              <Check className="size-4" />
                            ) : (
                              approval.assignedTo.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          {!isLast && (
                            <div
                              className={cn(
                                "w-px flex-1 my-1",
                                isDone ? "bg-emerald-200" : "bg-border",
                              )}
                              style={{ minHeight: "2rem" }}
                            />
                          )}
                        </div>

                        <div className={cn("flex-1 pb-5", isLast && "pb-0")}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground flex items-center flex-wrap gap-1">
                                {approval.assignedTo.name}
                                <span className="text-xs font-normal text-muted-foreground">Step {approval.step}</span>
                                {approval.required ? (
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800">
                                    Required
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                                    Optional
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {isDone ? "Approved" : isPending ? "Waiting for review" : isWaiting ? "Queued" : "Rejected"} · Requested by{" "}
                                {approval.requestedBy.name} · <RelativeTime date={approval.createdAt} />
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {approval.status === "pending" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  <Clock className="size-3" />
                                  Pending
                                </span>
                              )}
                              {approval.status === "approved" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  <CheckCircle className="size-3" />
                                  Approved
                                </span>
                              )}
                              {approval.status === "rejected" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                  <XCircle className="size-3" />
                                  Rejected
                                </span>
                              )}
                              {approval.status === "waiting" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  <Clock className="size-3" />
                                  Queued (Step {approval.step})
                                </span>
                              )}
                              {(isPending || isWaiting) &&
                                (approval.requestedBy.id === session?.user?.id || isAdminOrOwner) && (
                                <AlertDialog>
                                  <AlertDialogTrigger
                                    render={
                                      <button
                                        type="button"
                                        title={tWorkspace("cancelApprovalRequest")}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    }
                                  />
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{tWorkspace("cancelApprovalRequestTitle")}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {tWorkspace("cancelApprovalRequestDescription")}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{tWorkspace("keepApprovalRequest")}</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => cancelApproval(approval.id)}>
                                        {tWorkspace("cancelApprovalRequest")}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>

                          {approval.comment && (
                            <p className="mt-1.5 text-sm text-muted-foreground">{approval.comment}</p>
                          )}
                          {approval.decidedAt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Decided <RelativeTime date={approval.decidedAt} />
                            </p>
                          )}

                          {isMyApproval && !isDeciding && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                                onClick={() => setDeciding({ id: approval.id, intent: "approve" })}
                              >
                                <Check className="size-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                                onClick={() => setDeciding({ id: approval.id, intent: "reject" })}
                              >
                                <X className="size-3.5" />
                                Reject
                              </Button>
                            </div>
                          )}

                          {isMyApproval && isDeciding && (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                rows={2}
                                placeholder="Optional comment..."
                                value={decideComment}
                                onChange={(e) => setDecideComment(e.target.value)}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                {deciding?.intent === "approve" && (
                                  <Button
                                    size="sm"
                                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => decideApproval(approval.id, "approved", decideComment || undefined)}
                                  >
                                    Confirm Approve
                                  </Button>
                                )}
                                {deciding?.intent === "reject" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                                    onClick={() => decideApproval(approval.id, "rejected", decideComment || undefined)}
                                  >
                                    Confirm Reject
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7"
                                  onClick={() => { setDeciding(null); setDecideComment("") }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {approvals.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <Link href={`/contracts/${id}/approval`}>
                    <Button size="sm" className="w-full sm:w-auto">
                      View Full Workflow
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Signing */}
        {signingEnabled && <TabsContent value="signing" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("signingEyebrow")}
              title={tWorkspace("signingTitle")}
              description={tWorkspace("signingDescription")}
              action={
                <Link href={`/contracts/${id}/signing`}>
                  <Button size="sm" variant="outline" className="min-h-11">
                    {tWorkspace("manageSigning")}
                  </Button>
                </Link>
              }
            />
            <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    DocuSeal
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {contract.signingStatus === "completed"
                      ? tWorkspace("allSignaturesCollected")
                      : contract.signingStatus === "sent"
                      ? tWorkspace("awaitingSignatures")
                      : tWorkspace("signingNotStarted")}
                  </p>
                </div>
              </div>

              {contract.signingStatus && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground">{tWorkspace("signatureProgress")}</p>
                      <p className="text-xs font-medium text-foreground">
                        {contract.signingStatus === "completed" ? "100%" : contract.signingStatus === "sent" ? tWorkspace("inProgress") : "0%"}
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: contract.signingStatus === "completed" ? "100%" : contract.signingStatus === "sent" ? "33%" : "0%" }}
                      />
                    </div>
                  </div>

                  <div className="rounded-[var(--radius)] border border-border divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {contract.owner?.name.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{contract.owner?.name ?? tWorkspace("owner")}</p>
                          <p className="text-xs text-muted-foreground">{contract.owner?.email ?? ""}</p>
                        </div>
                      </div>
                      <SigningStatusBadge status={contract.signingStatus} />
                    </div>
                  </div>
                </>
              )}

              {!contract.signingStatus && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <p className="text-sm text-muted-foreground">
                    {tWorkspace("notSentForSigning")}
                  </p>
                  {canSendForSignature && (
                    <Button size="sm" onClick={sendForSignature}>
                      <Send className="size-4" />
                      {tWorkspace("sendForSigning")}
                    </Button>
                  )}
                </div>
              )}

              {contract.signingUrl && contract.signingStatus === "sent" && (
                <a
                  href={contract.signingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {tWorkspace("openSigningLink")} <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </TabsContent>}


        {/* Editor */}
        <TabsContent value="editor" className="flex-1 overflow-hidden m-0 border-0 flex flex-col">
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md rounded-[var(--radius)] border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="font-semibold text-foreground">{tWorkspace("editorPausedTitle")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {tWorkspace("editorPausedDescription")}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Obligations */}
        <TabsContent value="obligations" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("actionsEyebrow")}
              title={tWorkspace("actionsTitle")}
              description={tWorkspace("actionsDescription")}
            />
            <ObligationList
              contractId={contract.id}
              obligations={obligations}
              members={members}
              contractArchived={contract.status === "ARCHIVED"}
              role={currentMember?.role}
              hasContractFile={files.length > 0}
              hasExtractedText={contract.hasExtractedText === true}
              onChange={setObligations}
            />
          </div>
        </TabsContent>

        {/* Risk */}
        <TabsContent value="risk" className="flex-1 overflow-auto m-0 border-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 xl:p-8">
            <WorkspaceTabIntro
              eyebrow={tWorkspace("riskEyebrow")}
              title={tWorkspace("riskTitle")}
              description={tWorkspace("riskDescription")}
              action={canAnalyzeRisk ? (
                <Button
                  size="sm"
                  className="min-h-11"
                  onClick={analyzeRisk}
                  disabled={analyzingRisk || !contract.hasExtractedText}
                >
                  {analyzingRisk ? <><Loader2 className="size-4 animate-spin" />{tWorkspace("analyzingRisk")}</> : <><Shield className="size-4" />{riskData?.riskScore ? tWorkspace("reanalyzeRisk") : tWorkspace("analyzeRisk")}</>}
                </Button>
              ) : undefined}
            />
            {!riskData?.riskScore ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <Shield className="size-7 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{tWorkspace("noRiskAnalysisYet")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tWorkspace("noRiskAnalysisDescription")}
                  </p>
                </div>
                {!canAnalyzeRisk && (
                  <p className="text-xs text-muted-foreground">{tWorkspace("riskPermissions")}</p>
                )}
                {!contract.hasExtractedText && (
                  <p className="text-xs text-muted-foreground">
                    {files.length > 0
                      ? tWorkspace("riskProcessing")
                      : tWorkspace("riskNeedsSource")}
                  </p>
                )}
              </div>
            ) : (() => {
              const details = riskData.riskDetails as {
                overall?: string
                score?: number
                summary?: string
                categories?: Record<string, { level: string; finding: string; clause: string | null }>
              } | null
              const categories = details?.categories ?? {}
              const CATEGORY_LABELS: Record<string, string> = {
                liability: tWorkspace("riskLiability"),
                termination: tWorkspace("riskTermination"),
                autoRenewal: tWorkspace("riskAutoRenewal"),
                ipOwnership: tWorkspace("riskIpOwnership"),
                paymentTerms: tWorkspace("riskPaymentTerms"),
                governingLaw: tWorkspace("riskGoverningLaw"),
              }
              return (
                <>
                  {/* Hero section */}
                  <div className="rounded-[var(--radius)] border border-border bg-card p-6">
                    <div className="flex items-start justify-between gap-6 flex-wrap">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{tWorkspace("riskOverall")}</p>
                        <RiskBadge level={riskData.riskScore} size="md" />
                        {details?.summary && (
                          <p className="mt-3 max-w-lg text-sm text-foreground/80 leading-relaxed">
                            {details.summary}
                          </p>
                        )}
                        {riskData.riskScoredAt && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {tWorkspace("riskAnalyzed")} <RelativeTime date={riskData.riskScoredAt} />
                          </p>
                        )}
                      </div>
                      {/* Score gauge */}
                      {details?.score != null && (
                        <div className="flex flex-col items-center gap-1">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{tWorkspace("riskScore")}</p>
                          <div
                            className={cn(
                              "flex size-16 items-center justify-center rounded-full text-2xl font-bold",
                              details.score >= 67 ? "bg-red-100 text-red-700" :
                              details.score >= 34 ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700",
                            )}
                          >
                            {details.score}
                          </div>
                          <p className="text-xs text-muted-foreground">{tWorkspace("riskScoreOutOf")}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category cards 2x3 grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                      const cat = categories[key]
                      if (!cat) return null
                      return (
                        <div
                          key={key}
                          className={cn(
                            "rounded-[var(--radius)] border border-border bg-card p-4",
                            "border-s-4",
                            cat.level === "HIGH" ? "border-s-red-500" :
                            cat.level === "MEDIUM" ? "border-s-amber-500" :
                            "border-s-emerald-500",
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {label}
                            </p>
                            <RiskBadge level={cat.level} size="sm" />
                          </div>
                          <p className="text-[13px] text-foreground leading-snug">{cat.finding}</p>
                          {cat.clause && (
                            <p className="mt-2 text-xs italic text-muted-foreground line-clamp-2">
                              &ldquo;{cat.clause}&rdquo;
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={(open) => (open ? openEdit() : closeEdit())}>
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-5 py-5 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {tWorkspace("editRecordEyebrow")}
            </p>
            <SheetTitle className="mt-2 text-xl tracking-[-0.025em]">{tWorkspace("editContract")}</SheetTitle>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              {tWorkspace("editRecordDescription")}
            </p>
          </SheetHeader>
          <form
            aria-label={tWorkspace("editContract")}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              void saveEdit()
            }}
          >
            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-7">
              <section aria-labelledby="edit-core-details">
                <h3 id="edit-core-details" className="text-sm font-semibold text-foreground">
                  {tWorkspace("coreDetails")}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-title">{tWorkspace("title")}</Label>
                    <Input
                      id="contract-title"
                      className="min-h-11"
                      value={editForm.title ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-type">{tWorkspace("contractType")}</Label>
                    <Select
                      value={editForm.contractType ?? null}
                      onValueChange={(v) =>
                        setEditForm((p) => ({ ...p, contractType: v as typeof p.contractType }))
                      }
                    >
                      <SelectTrigger id="contract-type" className="min-h-11 w-full">
                        <SelectValue placeholder={tWorkspace("selectType")} />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section aria-labelledby="edit-counterparty-details" className="border-t border-border pt-6">
                <h3 id="edit-counterparty-details" className="text-sm font-semibold text-foreground">
                  {tWorkspace("counterpartyDetails")}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="counterparty-name">{tWorkspace("counterpartyName")}</Label>
                    <Input
                      id="counterparty-name"
                      className="min-h-11"
                      value={editForm.counterpartyName ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, counterpartyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="counterparty-email">{tWorkspace("counterpartyEmail")}</Label>
                    <Input
                      id="counterparty-email"
                      className="min-h-11"
                      type="email"
                      value={editForm.counterpartyContact ?? ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, counterpartyContact: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>

              <section aria-labelledby="edit-term-value" className="border-t border-border pt-6">
                <h3 id="edit-term-value" className="text-sm font-semibold text-foreground">
                  {tWorkspace("termAndValue")}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-value">{tWorkspace("value")}</Label>
                    <Input
                      id="contract-value"
                      className="min-h-11"
                      type="number"
                      value={editForm.value ?? ""}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          value: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-currency">{tWorkspace("currency")}</Label>
                    <Select
                      value={editForm.currency ?? "USD"}
                      onValueChange={(v) => setEditForm((p) => ({ ...p, currency: v }))}
                    >
                      <SelectTrigger id="contract-currency" className="min-h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-start-date">{tWorkspace("startDate")}</Label>
                    <Input
                      id="contract-start-date"
                      className="min-h-11"
                      type="date"
                      value={editForm.startDate ? editForm.startDate.slice(0, 10) : ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-end-date">{tWorkspace("endDate")}</Label>
                    <Input
                      id="contract-end-date"
                      className="min-h-11"
                      type="date"
                      value={editForm.endDate ? editForm.endDate.slice(0, 10) : ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-renewal-date">{tWorkspace("renewalDate")}</Label>
                    <Input
                      id="contract-renewal-date"
                      className="min-h-11"
                      type="date"
                      value={editForm.renewalDate ? editForm.renewalDate.slice(0, 10) : ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, renewalDate: e.target.value || null }))}
                    />
                  </div>
                  <label className="flex min-h-11 items-start gap-3 rounded-md border border-border p-3 sm:mt-6">
                    <input
                      id="contract-renewal-reminders"
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={editForm.renewalReminderEnabled !== false}
                      onChange={(e) => setEditForm((p) => ({ ...p, renewalReminderEnabled: e.target.checked }))}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{tWorkspace("renewals")}</span>
                      <span className="block text-xs text-muted-foreground">{tWorkspace("autoRenewalDescription")}</span>
                    </span>
                  </label>
                </div>
              </section>

              <section aria-labelledby="edit-additional-details" className="border-t border-border pt-6">
                <h3 id="edit-additional-details" className="text-sm font-semibold text-foreground">
                  {tWorkspace("additionalDetails")}
                </h3>
                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-governing-law">{tWorkspace("governingLaw")}</Label>
                    <Input
                      id="contract-governing-law"
                      className="min-h-11"
                      value={editForm.governingLaw ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, governingLaw: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-notes">{tWorkspace("notes")}</Label>
                    <Textarea
                      id="contract-notes"
                      className="min-h-32 resize-y"
                      rows={5}
                      value={editForm.notes ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                </div>
              </section>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-border bg-background px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <Button className="min-h-11 sm:order-2" type="submit" disabled={saving}>
                {saving ? tWorkspace("savingChanges") : tWorkspace("saveChanges")}
              </Button>
              <Button className="min-h-11" type="button" variant="outline" onClick={closeEdit}>
                {tWorkspace("cancel")}
              </Button>
            </footer>
          </form>
        </SheetContent>
      </Sheet>

      {/* Document Preview Dialog */}
      <Dialog open={previewFileState !== null} onOpenChange={(open) => { if (!open) setPreviewFileState(null) }}>
        <DialogContent className="w-[min(96vw,1100px)] max-w-none gap-0 p-0 overflow-hidden">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="truncate pe-8">{previewFileState?.file.filename ?? tWorkspace("documentPreview")}</DialogTitle>
            <DialogDescription>
              {previewFileState?.file.mimeType === "application/pdf" || previewFileState?.file.filename.toLowerCase().endsWith(".pdf")
                ? "Previewing the uploaded PDF"
                : "This file can be downloaded and opened in its native application."}
            </DialogDescription>
          </DialogHeader>
          {previewFileState && (
            previewFileState.file.mimeType === "application/pdf" || previewFileState.file.filename.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={previewFileState.url}
                title={`Preview of ${previewFileState.file.filename}`}
                className="h-[min(75vh,800px)] w-full bg-muted"
              />
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <FileText className="size-10 text-muted-foreground/50" />
                <p className="max-w-md text-sm text-muted-foreground">
                  Browser preview is available for PDFs. Download this DOCX file to review it in Word or LibreOffice.
                </p>
                <a
                  href={previewFileState.url}
                  download={previewFileState.file.filename}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Download document
                </a>
              </div>
            )
          )}
          {previewFileState && (
            <div className="flex justify-end border-t border-border px-5 py-3">
              <a
                href={previewFileState.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Open in new tab
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 mb-1">
              <Archive className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{tWorkspace("archiveContractTitle")}</DialogTitle>
            <DialogDescription>
              {tWorkspace("archiveContractDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <DialogClose render={<Button variant="outline" disabled={archiving} />}>
              {tWorkspace("cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={deleteContract}
              disabled={archiving}
            >
              {archiving ? tWorkspace("archiving") : tWorkspace("archiveContract")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tWorkspace("uploadFile")}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <FileUploadZone onFileSelect={setUploadFile} />
            <div className="flex gap-3">
              <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? tWorkspace("uploading") : tWorkspace("upload")}
              </Button>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                {tWorkspace("cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Approval Dialog */}
      <Dialog open={approvalOpen} onOpenChange={(open) => { setApprovalOpen(open); if (!open) setApprovalRequired(true) }}>
        <DialogContent className="sm:max-w-md gap-0 p-0 overflow-visible" showCloseButton={false}>

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[15px] font-semibold">{tWorkspace("approvalRequestTitle")}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tWorkspace("approvalRequestDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setApprovalOpen(false); setApprovalRequired(true) }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Body ──────────────────────────────────────────────── */}
          <div className="px-5 py-5 space-y-5">

            {/* Reviewer picker */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2">
                {tWorkspace("reviewer")} <span className="text-rose-400">*</span>
              </p>
              <ReviewerPicker
                value={approvalAssigneeId}
                members={members}
                currentUserId={session?.user?.id}
              onChange={(id) => setApprovalAssigneeId(id)}
              chooseReviewerLabel={tWorkspace("chooseReviewer")}
              noEligibleReviewersLabel={tWorkspace("noEligibleReviewers")}
              />
            </div>

            {/* Message */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2">
                {tWorkspace("message")} <span className="font-normal normal-case tracking-normal text-muted-foreground/50">{tWorkspace("optional")}</span>
              </p>
              <Textarea
                rows={3}
                placeholder={tWorkspace("approvalMessagePlaceholder")}
                value={approvalMessage}
                onChange={(e) => setApprovalMessage(e.target.value)}
                className="text-sm resize-none"
              />
            </div>

            {/* Required approver toggle */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tWorkspace("requiredApprover")}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {approvalRequired
                    ? tWorkspace("requiredApproverDescription")
                    : tWorkspace("optionalApproverDescription")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={approvalRequired}
                onClick={() => setApprovalRequired((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
                  approvalRequired ? "bg-primary" : "bg-input",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-150",
                    approvalRequired ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────── */}
          <DialogFooter className="px-5 py-3.5 gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setApprovalOpen(false); setApprovalRequired(true) }}
              className="min-w-[80px]"
            >
              {tWorkspace("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={requestApproval}
              disabled={!approvalAssigneeId || requestingApproval}
              className="min-w-[130px]"
            >
              {requestingApproval ? tWorkspace("requestingApproval") : tWorkspace("requestApproval")}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  )
}
