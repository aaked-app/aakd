"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveOrganization } from "@/lib/auth/client"

type AIStatus = { provider: string | null; model: string | null }

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama (self-hosted)",
}

export default function OrgSettingsPage() {
  const { data: activeOrg } = useActiveOrganization()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)

  useEffect(() => {
    if (activeOrg?.name) setName(activeOrg.name)
  }, [activeOrg])

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((data: AIStatus) => setAiStatus(data))
      .catch(() => setAiStatus({ provider: null, model: null }))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success("Organization updated")
    } catch {
      toast.error("Failed to update organization")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Organization</h1>
        <p className="text-sm text-zinc-500">Manage your organization settings</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">General</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orgName" className="text-sm font-medium text-zinc-700">Name</Label>
            <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Slug</Label>
            <Input value={activeOrg?.slug ?? ""} readOnly className="bg-zinc-50 text-zinc-500 cursor-not-allowed" />
            <p className="text-xs text-zinc-500">Slug cannot be changed after creation</p>
          </div>
          {activeOrg?.createdAt && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Created</Label>
              <p className="text-sm text-zinc-500">{format(new Date(activeOrg.createdAt), "MMMM d, yyyy")}</p>
            </div>
          )}
          <div className="border-t border-zinc-200 pt-4">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </div>

      {/* AI Configuration */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 mt-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">AI Configuration</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Provider</span>
            {aiStatus === null ? (
              <span className="text-sm text-zinc-400">Loading…</span>
            ) : aiStatus.provider ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                {PROVIDER_LABELS[aiStatus.provider] ?? aiStatus.provider}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
                <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
                Not configured
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Model</span>
            {aiStatus?.model ? (
              <span className="text-sm font-mono text-zinc-700">{aiStatus.model}</span>
            ) : (
              <span className="text-sm text-zinc-400">—</span>
            )}
          </div>
        </div>
        {!aiStatus?.provider && aiStatus !== null && (
          <p className="mt-3 text-xs text-zinc-500">
            Set <code className="bg-zinc-100 px-1 rounded">AI_PROVIDER</code> and the corresponding API key in your environment to enable AI extraction and Q&amp;A.
          </p>
        )}
      </div>
    </div>
  )
}
