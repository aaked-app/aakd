import Link from "next/link"

const settingsLinks = [
  { label: "Organization", href: "/settings/org" },
  { label: "Members", href: "/settings/members" },
  { label: "API Keys", href: "/settings/api-keys" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "My Notifications", href: "/settings/profile/notifications" },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <nav className="w-48 shrink-0 border-r border-zinc-200 bg-white p-4 space-y-0.5">
        {settingsLinks.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="block rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
