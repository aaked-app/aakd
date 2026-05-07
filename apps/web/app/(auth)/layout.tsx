import { Shield } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-zinc-900">ClauseFlow</span>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
