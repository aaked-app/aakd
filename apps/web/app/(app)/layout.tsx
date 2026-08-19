"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  FileText,
  Target,
  BarChart2,
  Settings,
  LogOut,
  Search,
  ChevronDown,
  RefreshCw,
  Menu,
  ListChecks,
} from "lucide-react"
import { useSession, useActiveOrganization, useListOrganizations, organization, signOut } from "@/lib/auth/client"
import { usePostHog } from "posthog-js/react"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { GlobalProviders } from "@/components/global-providers"
import { AakdLogoMark } from "@/components/aakd-logo"
import { useLocale, useTranslations } from "next-intl"
import { isActionLedgerUiEnabled } from "@/lib/actions/feature"

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  disabled?: boolean
  exact?: boolean
  /** Override the path prefix used for active-link detection */
  matchPrefix?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

// ─── Nav config (moved inside component — see AppLayout below) ───────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── SoonBadge ───────────────────────────────────────────────────────────────

function SoonBadge({ label }: { label: string }) {
  return (
    <span className="ms-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
      {label}
    </span>
  )
}

// ─── NavItemRow ──────────────────────────────────────────────────────────────

function NavItemRow({
  item,
  pathname,
  compactAtTablet,
  soonLabel,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  compactAtTablet: boolean
  soonLabel: string
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const activePrefix = item.matchPrefix ?? item.href
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(activePrefix)

  if (item.disabled) {
    return (
      <div
        className={cn(
          "flex min-h-11 items-center gap-2.5 rounded-[calc(var(--radius)-1px)] px-[10px] py-2 text-[13px] opacity-40 cursor-not-allowed select-none",
          compactAtTablet && "md:justify-center md:px-0 xl:justify-start xl:px-[10px]",
        )}
        title={item.label}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        <span className={cn(compactAtTablet && "md:hidden xl:inline")}>{item.label}</span>
        <span className={cn("ms-auto", compactAtTablet && "md:hidden xl:inline-flex")}><SoonBadge label={soonLabel} /></span>
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-[calc(var(--radius)-1px)] px-[10px] py-2 text-[13px] transition-colors",
        compactAtTablet && "md:justify-center md:px-0 xl:justify-start xl:px-[10px]",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-foreground/80 hover:bg-muted-foreground/[0.08] hover:text-foreground"
      )}
    >
      <Icon
        className="h-4 w-4 shrink-0"
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      <span className={cn(compactAtTablet && "md:hidden xl:inline")}>{item.label}</span>
    </Link>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  pathname,
  userName,
  userEmail,
  userImage,
  orgName,
  orgLogo,
  onSignOut,
  navSections,
  navigationLabel,
  searchLabel,
  signOutLabel,
  soonLabel,
  themeLabel,
  userAvatarLabel,
  compactAtTablet = false,
  className,
  onNavigate,
}: {
  pathname: string
  userName: string
  userEmail: string
  userImage?: string | null
  orgName: string
  orgLogo?: string | null
  onSignOut: () => void
  navSections: NavSection[]
  navigationLabel: string
  searchLabel: string
  signOutLabel: string
  soonLabel: string
  themeLabel: string
  userAvatarLabel: string
  compactAtTablet?: boolean
  className?: string
  onNavigate?: () => void
}) {
  return (
    <aside className={cn(
      "flex h-full w-[232px] shrink-0 flex-col border-e border-border bg-muted",
      compactAtTablet && "md:w-16 xl:w-[232px]",
      className,
    )}>
      {/* Logo row */}
      <div className={cn(
        "flex min-h-14 items-center gap-2.5 border-b border-border px-3 py-3",
        compactAtTablet && "md:justify-center md:px-2 xl:justify-start xl:px-3",
      )}>
        {orgLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={orgLogo} alt="" className="h-[26px] w-[26px] shrink-0 rounded object-cover" />
        ) : <AakdLogoMark size={26} />}
        <span className={cn("font-extrabold text-sm flex-1 min-w-0 truncate", compactAtTablet && "md:hidden xl:block")} style={{ fontFamily: "var(--font-sora), 'Sora', sans-serif", letterSpacing: '-0.02em' }}>
          Aakd
        </span>
        <span className={cn(compactAtTablet && "md:hidden xl:inline-flex")}><NotificationBell /></span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0", compactAtTablet && "md:hidden xl:block")} />
      </div>

      {/* Search bar */}
      <div className="px-2 pt-2 pb-1">
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-[calc(var(--radius)-1px)] border border-border bg-background px-[10px] py-2 text-[13px] text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground",
            compactAtTablet && "md:justify-center md:px-0 xl:justify-start xl:px-[10px]",
          )}
          onClick={() => {
            onNavigate?.()
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
            )
          }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span className={cn("flex-1 text-start", compactAtTablet && "md:hidden xl:block")}>{searchLabel}</span>
          <kbd className={cn("font-mono text-[11px] bg-muted border border-border rounded px-1 py-0.5 text-muted-foreground leading-none", compactAtTablet && "md:hidden xl:inline")}>
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav sections */}
      <nav aria-label={navigationLabel} className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className={cn("px-[10px] pt-[14px] pb-1 text-xs font-semibold tracking-[0.07em] text-muted-foreground uppercase", compactAtTablet && "md:sr-only xl:not-sr-only")}>
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavItemRow key={item.href} item={item} pathname={pathname} compactAtTablet={compactAtTablet} soonLabel={soonLabel} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      {/* Spacer is handled by flex-1 on nav above */}

      {/* Theme toggle row */}
      <div className={cn("flex items-center gap-2 px-3 py-2 border-t border-border", compactAtTablet && "md:justify-center md:px-2 xl:justify-start xl:px-3")}>
        <ThemeToggle label={themeLabel} />
        <span className={cn("text-xs text-muted-foreground", compactAtTablet && "md:hidden xl:inline")}>{themeLabel}</span>
      </div>

      {/* User card */}
      <div className="px-2 pb-2">
        <div className={cn("bg-background border border-border rounded-md p-2 flex items-center gap-2", compactAtTablet && "md:flex-col md:border-0 md:bg-transparent md:p-0 xl:flex-row xl:border xl:bg-background xl:p-2")}>
          {/* Avatar */}
          {userImage ? (
            <img src={userImage} className="h-7 w-7 rounded-full object-cover shrink-0" alt={userAvatarLabel} />
          ) : (
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">
                {getInitials(userName || userEmail)}
              </span>
            </div>
          )}
          {/* Info */}
          <div className={cn("flex-1 min-w-0", compactAtTablet && "md:hidden xl:block")}>
            <p className="font-semibold text-xs truncate leading-tight">
              {userName || userEmail}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {orgName}
            </p>
          </div>
          {/* Sign out */}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onSignOut}
            aria-label={signOutLabel}
            title={signOutLabel}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

// ─── AppLayout ───────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = useSession()
  const {
    data: activeOrg,
    error: activeOrgError,
    isPending: orgPending,
    refetch: refetchActiveOrganization,
  } = useActiveOrganization()
  const {
    data: orgs,
    error: orgsListError,
    isPending: orgsListPending,
    refetch: refetchOrganizations,
  } = useListOrganizations()
  const t = useTranslations("nav")
  const locale = useLocale()
  const ph = usePostHog()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activationFailure, setActivationFailure] = useState<{
    organizationId: string
    userId: string
  } | null>(null)
  const firstOrganizationId = orgs?.[0]?.id
  const sessionUserId = session?.user?.id

  const NAV_SECTIONS: NavSection[] = [
    {
      title: t("sections.core"),
      items: [
        { label: t("dashboard"),   href: "/dashboard",   icon: LayoutDashboard, exact: true },
        { label: t("contracts"),   href: "/contracts",   icon: FileText },
        { label: t("renewals"),    href: "/renewals",    icon: RefreshCw },
        { label: t("obligations"), href: "/obligations", icon: Target },
        ...(isActionLedgerUiEnabled() ? [{ label: t("actions"), href: "/actions", icon: ListChecks }] : []),
        { label: t("analytics"),   href: "/analytics",   icon: BarChart2 },
      ],
    },
    {
      title: t("sections.settings"),
      items: [
        { label: t("settings"), href: "/settings/org", icon: Settings, matchPrefix: "/settings" },
      ],
    },
  ]

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/login")
    }
  }, [isPending, session, router])

  // Better Auth only sets activeOrganizationId on the session when the client
  // explicitly calls setActive() (org creation, invite accept). A fresh
  // session — new device, cleared cookies, session renewal — has no
  // activeOrganizationId even though the user is a member of an org, and
  // useActiveOrganization() has no fallback of its own. resolveAuth() on the
  // server already falls back to the user's first membership (see
  // lib/auth/middleware.ts); mirror that here instead of showing a dead-end
  // "no organization" screen to someone who actually has one.
  useEffect(() => {
    if (
      isPending ||
      !sessionUserId ||
      orgPending ||
      activeOrgError ||
      orgsListPending ||
      orgsListError ||
      activeOrg ||
      !firstOrganizationId ||
      (
        activationFailure?.organizationId === firstOrganizationId &&
        activationFailure.userId === sessionUserId
      )
    ) return

    let cancelled = false
    organization.setActive({ organizationId: firstOrganizationId })
      .then((result) => {
        if (!cancelled && result?.error) {
          setActivationFailure({ organizationId: firstOrganizationId, userId: sessionUserId })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActivationFailure({ organizationId: firstOrganizationId, userId: sessionUserId })
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    isPending,
    sessionUserId,
    orgPending,
    activeOrgError,
    orgsListPending,
    orgsListError,
    activeOrg,
    firstOrganizationId,
    activationFailure,
  ])

  // Identify authenticated user in PostHog so events are tied to real people
  useEffect(() => {
    if (!session?.user || !ph) return
    ph.identify(session.user.id, {
      email: session.user.email,
      name: session.user.name,
      organizationId: activeOrg?.id,
      organizationName: activeOrg?.name,
    })
  }, [session?.user?.id, activeOrg?.id, ph])

  // While activeOrg is null but the org list hasn't resolved yet (or has, and
  // the auto-activate effect above just fired), keep showing the skeleton
  // rather than flashing the "no organization" screen.
  const activationError = !activeOrg &&
    activationFailure?.organizationId === firstOrganizationId &&
    activationFailure?.userId === sessionUserId
  const organizationResolutionError = !activeOrg && Boolean(
    activeOrgError || orgsListError || activationError
  )
  const resolvingOrg = !activeOrg && !organizationResolutionError && (
    orgsListPending || Boolean(orgs?.length)
  )

  const retryOrganizationResolution = () => {
    setActivationFailure(null)
    void refetchActiveOrganization()
    void refetchOrganizations()
  }

  const [orgLogo, setOrgLogo] = useState<string | null>(
    (activeOrg as { logo?: string | null } | null)?.logo ?? null,
  )

  useEffect(() => {
    if (!activeOrg?.id) {
      setOrgLogo(null)
      return
    }
    let cancelled = false
    fetch("/api/org")
      .then((response) => response.ok ? response.json() : null)
      .then((data: { logo?: string | null } | null) => {
        if (!cancelled) setOrgLogo(data?.logo ?? null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeOrg?.id])

  if (!isPending && session?.user && organizationResolutionError) {
    return (
      <main aria-label={t("workspaceUnavailable")} className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <AakdLogoMark size={36} />
        <div className="space-y-1.5 text-center">
          <h1 className="text-lg font-semibold text-foreground">{t("organizationLoadErrorTitle")}</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("organizationLoadErrorDescription")}
          </p>
        </div>
        <Button variant="outline" onClick={retryOrganizationResolution}>
          {t("retryOrganization")}
        </Button>
      </main>
    )
  }

  if (isPending || orgPending || resolvingOrg) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!session?.user) return null

  // User is authenticated, has no active org, and genuinely has zero
  // memberships — they registered without creating one (e.g. planning to
  // join via invitation). Show a holding screen instead of redirecting so
  // accept-invitation can resolve naturally.
  if (!activeOrg) {
    return (
      <main aria-label={t("workspaceUnavailable")} className="min-h-screen bg-background px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col border border-border bg-background sm:min-h-[calc(100vh-3rem)]">
          <header className="flex min-h-16 items-center justify-between border-b border-border px-5 sm:px-7">
            <div className="flex items-center gap-3">
              <AakdLogoMark size={32} />
              <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">Aakd</span>
            </div>
            <div className="flex min-w-0 items-center gap-1 sm:gap-3">
              <p className="max-w-[10rem] truncate text-end text-xs text-muted-foreground sm:max-w-xs">
                {session.user.email}
              </p>
              <Button
                variant="ghost"
                className="min-h-11 shrink-0 px-3 text-xs"
                onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })}
              >
                {t("signOut")}
              </Button>
            </div>
          </header>

          <div className="grid flex-1 lg:grid-cols-12">
            <section className="min-w-0 flex flex-col justify-between px-5 py-10 sm:px-7 sm:py-14 lg:col-span-7 lg:px-10 lg:py-16">
              <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  {t("workspaceSetupEyebrow")}
                </p>
                <h1 className="mt-5 max-w-lg text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                  {t("workspaceSetupTitle")}
                </h1>
                <p className="mt-5 max-w-lg break-words text-base leading-7 text-muted-foreground">
                  {t("workspaceSetupDescription")}
                </p>
              </div>

              <ol aria-label={t("workspaceSetupSteps")} className="mt-12 grid border-t border-border sm:grid-cols-3 lg:mt-20">
                {[
                  ["01", "setupStepWorkspace", "setupStepWorkspaceDescription"],
                  ["02", "setupStepAgreement", "setupStepAgreementDescription"],
                  ["03", "setupStepTeam", "setupStepTeamDescription"],
                ].map(([number, title, description]) => (
                  <li key={number} className="border-b border-border py-5 sm:border-b-0 sm:border-e sm:px-5 sm:first:ps-0 sm:last:border-e-0 sm:last:pe-0">
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{number}</span>
                    <p className="mt-3 text-sm font-semibold text-foreground">{t(title)}</p>
                    <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{t(description)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <aside className="min-w-0 flex items-center border-t border-border bg-muted/30 px-5 py-10 sm:px-7 lg:col-span-5 lg:border-t-0 lg:border-s lg:px-10 lg:py-16">
              <div className="w-full border border-border bg-background p-6 sm:p-7">
                <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {t("noOrganizationTitle")}
                </p>
                <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-foreground">
                  {t("createWorkspace")}
                </h2>
                <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
                  {t("noOrganizationDescription")}
                </p>
                <Button className="mt-7 min-h-11 w-full" onClick={() => router.push("/create-org")}>
                  {t("createWorkspace")}
                </Button>
                <div className="mt-7 border-t border-border pt-6">
                  <p className="text-sm font-medium text-foreground">{t("invitationTitle")}</p>
                  <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{t("invitationDescription")}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    )
  }

  const userName = session.user.name ?? ""
  const userEmail = session.user.email ?? ""
  const userImage = (session.user as { image?: string | null }).image ?? null
  const orgName = activeOrg?.name ?? ""

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background md:flex-row">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-muted px-3 md:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="-ms-1 size-11" aria-label={t("openNavigation")} />}
          >
            <Menu className="size-5" />
            <span className="sr-only">{t("openNavigation")}</span>
          </SheetTrigger>
          <SheetContent
            side={locale === "ar" ? "right" : "left"}
            closeLabel={t("closeNavigation")}
            className="w-[min(19rem,88vw)] gap-0 border-border bg-muted p-0 text-foreground"
          >
            <SheetTitle className="sr-only">Aakd</SheetTitle>
            <Sidebar
              pathname={pathname}
              userName={userName}
              userEmail={userEmail}
              userImage={userImage}
              orgName={orgName}
              orgLogo={orgLogo}
              onSignOut={() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })}
              navSections={NAV_SECTIONS}
              navigationLabel={t("mobileNavigation")}
              searchLabel={t("search")}
              signOutLabel={t("signOut")}
              soonLabel={t("soon")}
              themeLabel={t("theme")}
              userAvatarLabel={t("userAvatar")}
              className="w-full border-e-0"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="flex items-center gap-2">
          {orgLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgLogo} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
          ) : <AakdLogoMark size={24} />}
          <span className="text-sm font-extrabold" style={{ fontFamily: "var(--font-sora), 'Sora', sans-serif" }}>Aakd</span>
        </Link>
        <NotificationBell />
      </header>

      <Sidebar
        pathname={pathname}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
        orgName={orgName}
        orgLogo={orgLogo}
        onSignOut={() =>
          signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })
        }
        navSections={NAV_SECTIONS}
        navigationLabel={t("primaryNavigation")}
        searchLabel={t("search")}
        signOutLabel={t("signOut")}
        soonLabel={t("soon")}
        themeLabel={t("theme")}
        userAvatarLabel={t("userAvatar")}
        compactAtTablet
        className="hidden md:flex"
      />

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      <GlobalProviders />
    </div>
  )
}
