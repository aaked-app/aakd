"use client"

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowUpRight, Check, CheckCircle2, ChevronDown, ExternalLink, FileText } from "lucide-react"

import { AakdLogo } from "@/components/aakd-logo"
import { capturePublicMarketingEvent } from "@/components/providers/posthog-provider"

const REPOSITORY_URL = "https://github.com/aaked-app/aakd"
const SELF_HOSTING_URL = `${REPOSITORY_URL}/blob/main/docs/self-hosting.md`
const API_REFERENCE_URL = `${REPOSITORY_URL}/blob/main/docs/api-reference.md`
const SECURITY_URL = `${REPOSITORY_URL}/blob/main/SECURITY.md`

const locales = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
]

function LocaleSwitcher({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslations("landing")
  const [current, setCurrent] = useState("en")

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
    if (match && locales.some((locale) => locale.code === match[1])) setCurrent(match[1])
  }, [])

  function changeLocale(event: ChangeEvent<HTMLSelectElement>) {
    const locale = event.target.value
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    setCurrent(locale)
    window.location.reload()
  }

  return (
    <label className={mobile ? "relative block sm:hidden" : "relative hidden sm:block"}>
      <span className="sr-only">{t("nav.language")}</span>
      <select aria-label={t("nav.language")} value={current} onChange={changeLocale} className="h-11 appearance-none border border-[#c9c1b3] bg-[#f7f3eb] py-0 ps-3 pe-8 text-xs font-semibold text-[#2c332f] outline-none transition-colors focus-visible:border-[#245442] focus-visible:ring-2 focus-visible:ring-[#245442]/25 motion-reduce:transition-none">
        {locales.map((locale) => <option key={locale.code} value={locale.code}>{locale.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#5c625f]" />
    </label>
  )
}

function LandingHeader() {
  const t = useTranslations("landing")
  const navItems = [
    { label: t("nav.outcome"), href: "#outcome" },
    { label: t("nav.trust"), href: "#trust" },
    { label: t("nav.agentAccess"), href: "#agent-access" },
    { label: t("nav.capabilities"), href: "#capabilities" },
    { label: t("nav.selfHosting"), href: "#self-hosting" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[#c9c1b3] bg-[#f7f3eb]">
      <div className="mx-auto flex h-16 max-w-[88rem] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label={t("nav.home")} className="inline-flex min-h-11 shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f7f3eb]">
          <AakdLogo size={29} wordmarkClassName="text-[#17211c]" />
        </Link>
        <nav aria-label={t("nav.primary")} className="ms-7 hidden items-center gap-1 lg:flex">
          {navItems.map((item) => <a key={item.href} href={item.href} className="inline-flex min-h-11 items-center px-3 text-[13px] font-semibold text-[#5c625f] transition-colors hover:text-[#17211c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] motion-reduce:transition-none">{item.label}</a>)}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher />
          <Link href="/login" className="hidden min-h-11 items-center px-3 text-sm font-semibold text-[#2c332f] hover:text-[#245442] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] md:inline-flex">{t("nav.signIn")}</Link>
          <Link href="/register" onClick={() => capturePublicMarketingEvent("header_create_workspace")} className="hidden min-h-11 items-center border border-[#17211c] bg-[#17211c] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#245442] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] focus-visible:ring-offset-2 sm:inline-flex motion-reduce:transition-none">{t("nav.createWorkspace")}</Link>
          <details className="group relative lg:hidden">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center border border-[#c9c1b3] text-[#2c332f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442]">
              <span className="sr-only">{t("nav.menu")}</span>
              <span aria-hidden="true" className="space-y-1.5"><span className="block h-px w-4 bg-current" /><span className="block h-px w-4 bg-current" /><span className="block h-px w-4 bg-current" /></span>
            </summary>
            <nav aria-label={t("nav.mobile")} className="absolute end-0 top-12 w-64 border border-[#c9c1b3] bg-[#f7f3eb] p-2">
              {navItems.map((item) => <a key={item.href} href={item.href} className="flex min-h-11 items-center px-3 text-sm font-semibold text-[#2c332f] hover:bg-[#ebe5da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442]">{item.label}</a>)}
              <div className="mt-1 space-y-2 border-t border-[#d8d0c3] px-2 pt-3 md:hidden">
                <LocaleSwitcher mobile />
                <Link href="/login" className="flex min-h-11 items-center text-sm font-semibold text-[#2c332f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442]">{t("nav.signIn")}</Link>
                <Link href="/register" onClick={() => capturePublicMarketingEvent("menu_create_workspace")} className="flex min-h-11 items-center justify-center bg-[#17211c] px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] sm:hidden">{t("nav.createWorkspace")}</Link>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}

function Eyebrow({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${inverse ? "text-[#a7d7bd]" : "text-[#245442]"}`}>{children}</p>
}

function HeroProof() {
  const t = useTranslations("landing")
  return (
    <figure aria-label={t("proof.diagramLabel")} className="border border-[#aca394] bg-[#fbfaf6]">
      <figcaption className="flex flex-col gap-3 border-b border-[#c9c1b3] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex min-w-0 items-center gap-3"><FileText aria-hidden="true" className="size-4 shrink-0 text-[#245442]" /><span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[#686d69]">{t("proof.diagramLabel")}</span><bdi dir="auto" className="mt-1 block truncate text-sm font-semibold text-[#17211c]">{t("proof.filename")}</bdi></span></span>
        <span className="inline-flex w-fit items-center gap-2 border border-[#82a791] bg-[#e6eee8] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#245442]"><CheckCircle2 aria-hidden="true" className="size-3.5" />{t("proof.verified")}</span>
      </figcaption>
      <div className="grid lg:grid-cols-12">
        <div className="border-b border-[#c9c1b3] p-5 sm:p-7 lg:col-span-7 lg:border-b-0 lg:border-e">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#245442]">{t("proof.extraction.label")}</p><span className="border border-[#d4ad68] bg-[#fff5dd] px-2.5 py-1 text-xs font-semibold text-[#75531e]">{t("proof.extraction.status")}</span></div>
          <blockquote className="mt-8 border-s-2 border-[#245442] ps-5"><p className="font-[var(--font-sora)] text-xl font-semibold tracking-[-0.025em] text-[#17211c] sm:text-2xl">{t("proof.extraction.title")}</p><p dir="auto" className="mt-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#686d69]">{t("proof.extraction.source")}</p></blockquote>
          <p className="mt-9 flex items-center gap-2 border-t border-[#ddd5c8] pt-4 text-sm text-[#515854]"><Check aria-hidden="true" className="size-4 shrink-0 text-[#245442]" />{t("proof.activity")}</p>
        </div>
        <div className="p-5 sm:p-7 lg:col-span-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#686d69]">{t("proof.obligation.label")}</p><h2 className="mt-3 max-w-md font-[var(--font-sora)] text-xl font-semibold tracking-[-0.025em] text-[#17211c]">{t("proof.obligation.title")}</h2></div><span className="border border-[#aca394] px-2.5 py-1 text-xs font-semibold text-[#3f4642]">{t("proof.obligation.status")}</span></div>
          <dl className="mt-8 grid grid-cols-2 border-y border-[#c9c1b3]"><div className="border-e border-[#c9c1b3] py-4 pe-4"><dt className="text-xs text-[#686d69]">{t("proof.obligation.ownerLabel")}</dt><dd className="mt-1 text-sm font-bold text-[#17211c]">{t("proof.obligation.owner")}</dd></div><div className="py-4 ps-4"><dt className="text-xs text-[#686d69]">{t("proof.obligation.dueLabel")}</dt><dd className="mt-1 text-sm font-bold text-[#17211c]">{t("proof.obligation.due")}</dd></div></dl>
          <div className="mt-6 bg-[#17211c] px-4 py-4 text-white"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a7d7bd]">{t("proof.access.title")}</p><ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{[0, 1, 2].map((index) => <li key={index} className="flex items-center gap-1.5 text-xs text-[#dbe6df]"><span aria-hidden="true" className="size-1.5 bg-[#75b38f]" />{t(`proof.access.items.${index}`)}</li>)}</ul></div>
        </div>
      </div>
    </figure>
  )
}

function Hero() {
  const t = useTranslations("landing")
  return (
    <section className="border-b border-[#c9c1b3] bg-[#f3efe6]">
      <div className="mx-auto max-w-[88rem] px-4 py-14 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8"><Eyebrow>{t("heroNew.eyebrow")}</Eyebrow><h1 className="mt-5 max-w-5xl text-balance font-[var(--font-sora)] text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[#17211c] sm:text-6xl lg:text-7xl xl:text-[5.25rem]">{t("heroNew.title")}</h1></div>
          <div className="flex flex-col justify-end lg:col-span-4 lg:pb-1"><p className="max-w-xl text-base leading-7 text-[#515854] sm:text-lg sm:leading-8">{t("heroNew.subtitle")}</p><div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row"><Link href="/register" onClick={() => capturePublicMarketingEvent("hero_create_workspace")} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#17211c] px-5 text-sm font-bold text-white transition-colors hover:bg-[#245442] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3efe6] motion-reduce:transition-none">{t("heroNew.primaryCta")}<ArrowUpRight className="size-4" aria-hidden="true" /></Link><Link href={REPOSITORY_URL} onClick={() => capturePublicMarketingEvent("hero_view_github")} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#8f877a] px-5 text-sm font-bold text-[#17211c] transition-colors hover:bg-[#e8e2d7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442] motion-reduce:transition-none"><ExternalLink className="size-4" aria-hidden="true" />{t("heroNew.secondaryCta")}</Link></div><p className="mt-5 text-sm leading-6 text-[#686d69]">{t("heroNew.qualifier")}</p></div>
        </div>
        <div className="mt-14 lg:mt-20"><HeroProof /></div>
      </div>
    </section>
  )
}

function WorkflowStrip() {
  const t = useTranslations("landing")
  return (
    <section id="outcome" className="scroll-mt-20 border-b border-[#c9c1b3] bg-[#fbfaf6]"><div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-10"><ol aria-label={t("lifecycle.eyebrow")} className="grid md:grid-cols-4">{[0, 1, 2, 3].map((index) => <li key={index} className="border-b border-[#d8d0c3] py-6 last:border-b-0 md:border-b-0 md:border-e md:px-6 md:first:ps-0 md:last:border-e-0 md:last:pe-0"><p className="font-mono text-[11px] font-bold text-[#777c78]">0{index + 1}</p><h2 className="mt-3 text-sm font-bold text-[#17211c]">{t(`lifecycle.items.${index}.title`)}</h2><p className="mt-2 text-sm leading-6 text-[#686d69]">{t(`lifecycle.items.${index}.description`)}</p></li>)}</ol></div></section>
  )
}

function ProductNarratives() {
  const t = useTranslations("landing")
  return (
    <section id="trust" className="scroll-mt-20 bg-[#fbfaf6] py-20 sm:py-28"><div className="mx-auto max-w-[88rem] space-y-20 px-4 sm:px-6 lg:space-y-28 lg:px-10">
      <article className="grid gap-10 border-t border-[#aca394] pt-7 lg:grid-cols-12 lg:gap-6"><div className="lg:col-span-5"><Eyebrow>{t("trust.eyebrow")}</Eyebrow><h2 className="mt-5 max-w-xl font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-[#17211c] sm:text-5xl">{t("trust.title")}</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#5c625f]">{t("trust.subtitle")}</p></div><div className="lg:col-span-7 lg:ps-8"><div className="border-y border-[#c9c1b3]">{[0, 1, 2].map((index) => <div key={index} className="grid gap-3 border-b border-[#d8d0c3] py-5 last:border-b-0 sm:grid-cols-[2.5rem_1fr]"><span className="font-mono text-xs font-bold text-[#245442]">0{index + 1}</span><div><h3 className="font-semibold text-[#17211c]">{t(`trust.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-[#686d69]">{t(`trust.items.${index}.description`)}</p></div></div>)}</div></div></article>
      <article className="grid gap-10 border-t border-[#aca394] pt-7 lg:grid-cols-12 lg:gap-6"><div className="lg:col-span-5 lg:col-start-8"><Eyebrow>{t("operations.eyebrow")}</Eyebrow><h2 className="mt-5 max-w-xl font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-[#17211c] sm:text-5xl">{t("operations.title")}</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#5c625f]">{t("operations.subtitle")}</p></div><div className="lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:pe-8"><div className="border border-[#aca394] bg-[#f3efe6]"><div className="flex items-center justify-between border-b border-[#c9c1b3] px-5 py-4"><span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#5c625f]">{t("proof.obligation.label")}</span><span className="text-xs font-semibold text-[#245442]">{t("proof.obligation.status")}</span></div><div className="p-5 sm:p-7"><p className="text-xl font-semibold text-[#17211c]">{t("proof.obligation.title")}</p><dl className="mt-7 grid gap-px bg-[#c9c1b3] sm:grid-cols-2"><div className="bg-[#fbfaf6] p-4"><dt className="text-xs text-[#686d69]">{t("proof.obligation.ownerLabel")}</dt><dd className="mt-1 font-bold text-[#17211c]">{t("proof.obligation.owner")}</dd></div><div className="bg-[#fbfaf6] p-4"><dt className="text-xs text-[#686d69]">{t("proof.obligation.dueLabel")}</dt><dd className="mt-1 font-bold text-[#17211c]">{t("proof.obligation.due")}</dd></div></dl><p className="mt-5 border-s-2 border-[#245442] ps-4 text-sm leading-6 text-[#515854]">{t("operations.items.3.description")}</p></div></div></div></article>
    </div></section>
  )
}

function AgentAccessSection() {
  const t = useTranslations("landing")
  return (
    <section id="agent-access" className="scroll-mt-20 border-y border-black bg-[#17211c] py-20 text-white sm:py-28"><div className="mx-auto grid max-w-[88rem] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-6 lg:px-10"><div className="lg:col-span-5"><Eyebrow inverse>{t("agent.eyebrow")}</Eyebrow><h2 className="mt-5 max-w-xl font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{t("agent.title")}</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#bdc9c1]">{t("agent.subtitle")}</p><p className="mt-7 max-w-lg border-s border-[#679c7d] ps-4 text-sm leading-6 text-[#9eaaa2]">{t("agent.caveat")}</p></div><div className="lg:col-span-7 lg:ps-8"><div className="border border-[#496355]"><div className="flex items-center justify-between border-b border-[#496355] px-4 py-4 sm:px-6"><div><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#a7d7bd]">{t("agent.gatewayTitle")}</p><p className="mt-1 text-xs text-[#9eaaa2]">{t("agent.gatewayStatus")}</p></div><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#75b38f]">API / MCP</span></div><ol className="divide-y divide-[#496355]">{[0, 1, 2, 3].map((index) => <li key={index} className="grid gap-3 px-4 py-5 sm:grid-cols-[3rem_1fr] sm:px-6"><span className="font-mono text-xs text-[#75b38f]">0{index + 1}</span><div><h3 className="text-sm font-bold text-white">{t(`agent.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-[#9eaaa2]">{t(`agent.items.${index}.description`)}</p></div></li>)}</ol></div></div></div></section>
  )
}

function CapabilitiesSection() {
  const t = useTranslations("landing")
  return (
    <section id="capabilities" className="scroll-mt-20 bg-[#f3efe6] py-20 sm:py-28"><div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-10"><div className="grid gap-8 lg:grid-cols-12 lg:gap-6"><div className="lg:col-span-7"><Eyebrow>{t("capabilities.eyebrow")}</Eyebrow><h2 className="mt-5 max-w-4xl font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-[#17211c] sm:text-5xl">{t("capabilities.title")}</h2></div><p className="max-w-xl text-base leading-7 text-[#5c625f] lg:col-span-5 lg:self-end">{t("capabilities.subtitle")}</p></div><ul aria-label={t("capabilities.title")} className="mt-10 divide-y divide-[#c9c1b3] border-y border-[#8f877a] md:hidden">{[0, 1, 2, 3, 4, 5].map((index) => <li key={index} className="py-5"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold text-[#17211c]">{t(`capabilities.items.${index}.title`)}</h3><span className="shrink-0 border border-[#aca394] bg-[#fbfaf6] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3f4642]">{t(`capabilities.items.${index}.status`)}</span></div><p className="mt-3 text-sm leading-6 text-[#5c625f]">{t(`capabilities.items.${index}.description`)}</p></li>)}</ul><div className="mt-12 hidden border-y border-[#8f877a] md:block"><table className="hidden w-full table-fixed border-collapse text-start md:table" aria-label={t("capabilities.title")}><tbody className="divide-y divide-[#c9c1b3]">{[0, 1, 2, 3, 4, 5].map((index) => <tr key={index} className="align-top"><th scope="row" className="w-[30%] px-4 py-5 text-start text-sm font-bold text-[#17211c]">{t(`capabilities.items.${index}.title`)}</th><td className="w-[18%] px-4 py-5"><span className="border border-[#aca394] bg-[#fbfaf6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#3f4642]">{t(`capabilities.items.${index}.status`)}</span></td><td className="px-4 py-5 text-sm leading-6 text-[#5c625f]">{t(`capabilities.items.${index}.description`)}</td></tr>)}</tbody></table></div><p className="mt-5 max-w-4xl text-xs leading-5 text-[#686d69]">{t("capabilities.statusNote")}</p></div></section>
  )
}

function SelfHostingSection() {
  const t = useTranslations("landing")
  return (
    <section id="self-hosting" className="scroll-mt-20 border-y border-[#c9c1b3] bg-[#fbfaf6] py-20 sm:py-28"><div className="mx-auto grid max-w-[88rem] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-6 lg:px-10"><div className="min-w-0 lg:col-span-5"><Eyebrow>{t("selfHost.eyebrow")}</Eyebrow><h2 className="mt-5 max-w-xl font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-[#17211c] sm:text-5xl">{t("selfHost.title")}</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#5c625f]">{t("selfHost.subtitle")}</p><ul className="mt-8 divide-y divide-[#d8d0c3] border-y border-[#d8d0c3]">{[0, 1, 2].map((index) => <li key={index} className="py-4"><p className="font-bold text-[#17211c]">{t(`selfHost.items.${index}.title`)}</p><p className="mt-1 text-sm leading-6 text-[#686d69]">{t(`selfHost.items.${index}.description`)}</p></li>)}</ul><Link href={SELF_HOSTING_URL} onClick={() => capturePublicMarketingEvent("self_hosting_guide")} className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#245442] underline decoration-[#75b38f] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442]">{t("selfHost.guide")}<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div><div className="min-w-0 lg:col-span-7 lg:ps-8"><div className="border border-black bg-[#101713]"><div className="flex items-center justify-between border-b border-[#3e4b44] px-5 py-4"><span className="font-mono text-xs font-semibold text-[#9eaaa2]">{t("selfHost.terminalLabel")}</span><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#75b38f]">AGPL-3.0</span></div><pre className="max-w-full overflow-x-auto p-5 text-start font-mono text-xs leading-7 text-[#dbe6df] sm:p-7 sm:text-sm" dir="ltr"><code><span className="text-[#75b38f]">$</span> git clone https://github.com/aaked-app/aakd.git{"\n"}<span className="text-[#75b38f]">$</span> cd aakd{"\n"}<span className="text-[#75b38f]">$</span> cp .env.example .env{"\n"}<span className="text-[#75b38f]">$</span> docker compose up</code></pre><p className="border-t border-[#3e4b44] px-5 py-4 text-xs leading-5 text-[#9eaaa2] sm:px-7">{t("selfHost.requirements")}</p></div></div></div></section>
  )
}

function FAQSection() {
  const t = useTranslations("landing")
  return (
    <section id="faq" className="scroll-mt-20 bg-[#f3efe6] py-20 sm:py-28"><div className="mx-auto grid max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-6 lg:px-10"><div className="lg:col-span-5"><Eyebrow>{t("faqNew.eyebrow")}</Eyebrow><h2 className="mt-5 font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-[#17211c] sm:text-5xl">{t("faqNew.title")}</h2><p className="mt-6 max-w-md text-base leading-7 text-[#5c625f]">{t("faqNew.subtitle")}</p></div><div className="border-y border-[#8f877a] lg:col-span-7 lg:ms-8">{[0, 1, 2].map((index) => <details key={index} className="group border-b border-[#c9c1b3] last:border-b-0"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-start font-bold text-[#17211c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245442]">{t(`faqNew.items.${index}.question`)}<ChevronDown className="size-5 shrink-0 text-[#686d69] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary><p className="max-w-3xl pb-6 text-sm leading-7 text-[#5c625f]">{t(`faqNew.items.${index}.answer`)}</p></details>)}</div></div></section>
  )
}

function FinalCTA() {
  const t = useTranslations("landing")
  return (
    <section className="border-y border-black bg-[#245442] py-14 sm:py-20"><div className="mx-auto grid max-w-[88rem] gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-end lg:gap-6 lg:px-10"><div className="lg:col-span-8"><h2 className="max-w-4xl text-balance font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t("finalCta.title")}</h2><p className="mt-4 max-w-2xl text-base leading-7 text-[#dbe6df]">{t("finalCta.subtitle")}</p></div><div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:justify-end"><Link href="/register" onClick={() => capturePublicMarketingEvent("final_create_workspace")} className="inline-flex min-h-11 items-center justify-center bg-white px-5 text-sm font-bold text-[#17211c] hover:bg-[#edf2ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#245442]">{t("finalCta.primary")}</Link><Link href={REPOSITORY_URL} onClick={() => capturePublicMarketingEvent("final_view_github")} className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/60 px-5 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ExternalLink className="size-4" aria-hidden="true" />{t("finalCta.secondary")}</Link></div></div></section>
  )
}

function LandingFooter() {
  const t = useTranslations("landing")
  return (
    <footer className="bg-[#101713] py-12 text-[#9eaaa2]"><div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-10"><div className="grid gap-10 border-b border-[#3e4b44] pb-10 md:grid-cols-[1.3fr_1fr_1fr]"><div className="max-w-sm"><AakdLogo size={29} wordmarkClassName="text-white" /><p className="mt-4 text-sm leading-6">{t("footerNew.tagline")}</p></div><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">{t("footerNew.product")}</p><nav aria-label={t("footerNew.product")} className="mt-4 flex flex-col items-start gap-3 text-sm"><a href="#outcome" className="hover:text-white">{t("nav.outcome")}</a><a href="#agent-access" className="hover:text-white">{t("nav.agentAccess")}</a><a href="#capabilities" className="hover:text-white">{t("nav.capabilities")}</a></nav></div><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">{t("footerNew.resources")}</p><nav aria-label={t("footerNew.resources")} className="mt-4 flex flex-col items-start gap-3 text-sm"><Link href={SELF_HOSTING_URL} onClick={() => capturePublicMarketingEvent("footer_self_hosting")} className="hover:text-white">{t("footerNew.selfHosting")}</Link><Link href={API_REFERENCE_URL} onClick={() => capturePublicMarketingEvent("footer_api_reference")} className="hover:text-white">{t("footerNew.api")}</Link><Link href={SECURITY_URL} onClick={() => capturePublicMarketingEvent("footer_security")} className="hover:text-white">{t("footerNew.security")}</Link></nav></div></div><div className="flex flex-col gap-4 pt-7 text-xs sm:flex-row sm:items-center sm:justify-between"><p>{t("footerNew.copyright")}</p><Link href={REPOSITORY_URL} onClick={() => capturePublicMarketingEvent("footer_view_github")} className="inline-flex items-center gap-2 font-semibold hover:text-white"><ExternalLink className="size-4" aria-hidden="true" />{t("footerNew.github")}</Link></div></div></footer>
  )
}

export default function LandingPage() {
  return <div className="min-h-screen bg-[#f3efe6] text-[#17211c] [color-scheme:light]"><LandingHeader /><main><Hero /><WorkflowStrip /><ProductNarratives /><AgentAccessSection /><CapabilitiesSection /><SelfHostingSection /><FAQSection /><FinalCTA /></main><LandingFooter /></div>
}
