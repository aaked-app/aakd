"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  Users,
  Key,
  ClipboardList,
  Plug2,
  Upload,
  Bell,
  Mail,
  User,
} from "lucide-react"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

interface SettingsLink {
  label: string
  href: string
  icon: React.ElementType
  disabled?: boolean
}

interface SettingsGroup {
  title: string
  items: SettingsLink[]
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations("nav")

  const SETTINGS_GROUPS: SettingsGroup[] = [
    {
      title: t("sections.workspace"),
      items: [
        { label: t("organization"),      href: "/settings/org",           icon: Building2 },
        { label: t("members"),           href: "/settings/members",       icon: Users },
        { label: t("apiKeys"),           href: "/settings/api-keys",      icon: Key },
        { label: t("auditLog"),          href: "/settings/audit-log",     icon: ClipboardList },
      ],
    },
    {
      title: t("sections.integrations"),
      items: [
        { label: t("integrations"),  href: "/settings/integrations", icon: Plug2 },
        { label: t("import"),        href: "/settings/import",       icon: Upload },
      ],
    },
    {
      title: t("sections.notifications"),
      items: [
        { label: t("orgNotifications"), href: "/settings/notifications",         icon: Bell },
        { label: t("myNotifications"),  href: "/settings/profile/notifications", icon: Mail },
      ],
    },
    {
      title: t("sections.account"),
      items: [
        { label: t("myProfile"), href: "/settings/profile", icon: User },
      ],
    },
  ]

  const activeItem = SETTINGS_GROUPS.flatMap((group) => group.items).find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  )

  return (
    <div className="flex min-h-full min-w-0 flex-col md:flex-row">
      <div className="border-b border-border bg-muted p-3 md:hidden">
        <label htmlFor="settings-section" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t("settingsSection")}
        </label>
        <select
          id="settings-section"
          aria-label={t("settingsNavigation")}
          value={activeItem?.href ?? "/settings/profile"}
          onChange={(event) => { window.location.href = event.target.value }}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {SETTINGS_GROUPS.flatMap((group) => group.items).map(({ href, label }) => (
            <option key={href} value={href}>{label}</option>
          ))}
        </select>
      </div>
      <nav aria-label={t("settingsNavigation")} className="hidden w-52 shrink-0 border-e border-border bg-muted p-2 md:flex md:flex-col">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-[10px] pt-3 pb-1 text-[10px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon, disabled }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/")
                if (disabled) {
                  return (
                    <div
                      key={href}
                      className="flex items-center gap-2.5 rounded-[calc(var(--radius)-1px)] px-[10px] py-[6px] text-[13px] opacity-40 cursor-not-allowed select-none"
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      <span>{label}</span>
                      <span className="ms-auto text-[9px] font-semibold bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-full">
                        Soon
                      </span>
                    </div>
                  )
                }
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[calc(var(--radius)-1px)] px-[10px] py-[6px] text-[13px] transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-muted-foreground/[0.08] hover:text-foreground",
                    )}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <div className="mt-auto pt-3 border-t border-border space-y-2">
          <p className="px-[10px] text-[10px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
            {t("sections.language")}
          </p>
          <div className="px-[10px]">
            <LocaleSwitcher className="w-full" />
          </div>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
