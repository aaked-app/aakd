"use client"

// The landing page reads the locale cookie in the browser. Keep it dynamic so
// production builds do not try to serialize the client-only translation tree.
export const dynamic = "force-dynamic"

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ArrowUpRight,
  BookOpenText,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  FileCheck2,
  FileSearch,
  ExternalLink,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Workflow,
} from "lucide-react"

import { AakdLogo } from "@/components/aakd-logo"

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

function LandingLocaleSwitcher({ mobile = false }: { mobile?: boolean }) {
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
      <select
        aria-label={t("nav.language")}
        value={current}
        onChange={changeLocale}
        className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-0 ps-3 pe-8 text-xs font-semibold text-slate-700 outline-none transition focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/20 motion-reduce:transition-none"
      >
        {locales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t("nav.home")} className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-4">
          <AakdLogo size={30} wordmarkClassName="text-slate-950" />
        </Link>

        <nav aria-label={t("nav.primary")} className="ms-5 hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 motion-reduce:transition-none">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LandingLocaleSwitcher />
          <Link href="/login" className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 md:inline-flex motion-reduce:transition-none">
            {t("nav.signIn")}
          </Link>
          <Link href="/register" className="hidden h-9 items-center rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 sm:inline-flex motion-reduce:transition-none">
            {t("nav.createWorkspace")}
          </Link>

          <details className="group relative lg:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 motion-reduce:transition-none">
              <span className="sr-only">{t("nav.menu")}</span>
              <span aria-hidden="true" className="space-y-1.5">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </summary>
            <nav aria-label={t("nav.mobile")} className="absolute end-0 top-11 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {item.label}
                </a>
              ))}
              <div className="mt-1 space-y-2 border-t border-slate-100 px-2 pt-3 md:hidden">
                <LandingLocaleSwitcher mobile />
                <Link href="/login" className="block rounded-md px-1 py-2 text-sm font-semibold text-slate-700">{t("nav.signIn")}</Link>
                <Link href="/register" className="flex min-h-10 items-center justify-center rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white sm:hidden">{t("nav.createWorkspace")}</Link>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}

function Eyebrow({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return <p className={`mb-4 text-xs font-bold uppercase tracking-[0.18em] ${inverse ? "text-emerald-300" : "text-emerald-800"}`}>{children}</p>
}

function SectionHeading({ eyebrow, title, description, inverse = false }: { eyebrow: string; title: string; description: string; inverse?: boolean }) {
  return (
    <div className="max-w-3xl">
      <Eyebrow inverse={inverse}>{eyebrow}</Eyebrow>
      <h2 className={`text-balance font-[var(--font-sora)] text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl lg:text-5xl ${inverse ? "text-white" : "text-slate-950"}`}>{title}</h2>
      <p className={`mt-5 max-w-2xl text-base leading-7 sm:text-lg ${inverse ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
    </div>
  )
}

function ProofField({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{term}</dt>
      <dd className="text-end font-semibold text-slate-800">{value}</dd>
    </div>
  )
}

function ProofCard({ number, icon, label, tone, children }: { number: string; icon: ReactNode; label: string; tone: "slate" | "emerald" | "navy"; children: ReactNode }) {
  const tones = { slate: "bg-slate-100 text-slate-700", emerald: "bg-emerald-100 text-emerald-800", navy: "bg-slate-900 text-white" }
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{icon}{label}</span>
        <span className="font-mono text-xs text-slate-400">{number}</span>
      </div>
      {children}
    </article>
  )
}

function HeroProof() {
  const t = useTranslations("landing")
  return (
    <figure id="outcome" aria-label={t("proof.diagramLabel")} className="relative scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/10 sm:p-5">
      <div aria-hidden="true" className="absolute -inset-12 -z-10 rounded-full bg-emerald-200/30 blur-3xl" />
      <figcaption className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200"><Sparkles className="size-3.5" aria-hidden="true" />{t("proof.synthetic")}</span>
        <span className="text-xs font-medium text-slate-500">{t("proof.filename")}</span>
      </figcaption>
      <div className="grid gap-3 lg:grid-cols-3">
        <ProofCard number="01" icon={<FileSearch className="size-4" />} label={t("proof.source.label")} tone="slate">
          <div className="mt-4 rounded-lg border-s-2 border-emerald-700 bg-slate-50 p-3.5">
            <p className="text-sm font-semibold text-slate-950">{t("proof.source.exact")}</p>
            <blockquote className="mt-2 text-sm leading-6 text-slate-600">“{t("proof.source.excerpt")}”</blockquote>
            <p className="mt-3 text-xs font-semibold text-emerald-800">{t("proof.source.page")}</p>
          </div>
        </ProofCard>
        <ProofCard number="02" icon={<Sparkles className="size-4" />} label={t("proof.suggestion.label")} tone="emerald">
          <h3 className="mt-4 font-bold text-slate-950">{t("proof.suggestion.title")}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("proof.suggestion.description")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{t("proof.suggestion.confidence")}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{t("proof.suggestion.review")}</span>
          </div>
        </ProofCard>
        <ProofCard number="03" icon={<UserCheck className="size-4" />} label={t("proof.action.label")} tone="navy">
          <h3 className="mt-4 font-bold text-slate-950">{t("proof.action.title")}</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <ProofField term={t("proof.action.ownerLabel")} value={t("proof.action.owner")} />
            <ProofField term={t("proof.action.dueLabel")} value={t("proof.action.due")} />
            <ProofField term={t("proof.action.evidenceLabel")} value={t("proof.action.evidence")} />
          </dl>
        </ProofCard>
      </div>
    </figure>
  )
}

function Hero() {
  const t = useTranslations("landing")
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_36%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)]">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-28">
        <div>
          <Eyebrow>{t("heroNew.eyebrow")}</Eyebrow>
          <h1 className="text-balance font-[var(--font-sora)] text-4xl font-extrabold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.06]">{t("heroNew.title")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">{t("heroNew.subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 motion-reduce:transition-none">{t("heroNew.primaryCta")}<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
            <Link href={REPOSITORY_URL} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 motion-reduce:transition-none"><ExternalLink className="size-4" aria-hidden="true" />{t("heroNew.secondaryCta")}</Link>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-slate-500"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{t("heroNew.qualifier")}</p>
        </div>
        <HeroProof />
      </div>
    </section>
  )
}

const trustIcons = [BookOpenText, UserCheck, RefreshCw]
function TrustSection() {
  const t = useTranslations("landing")
  return (
    <section id="trust" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t("trust.eyebrow")} title={t("trust.title")} description={t("trust.subtitle")} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {trustIcons.map((Icon, index) => <article key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-6"><span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800"><Icon className="size-5" aria-hidden="true" /></span><h3 className="mt-5 text-lg font-bold text-slate-950">{t(`trust.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t(`trust.items.${index}.description`)}</p></article>)}
        </div>
      </div>
    </section>
  )
}

const agentIcons = [KeyRound, FileCheck2, ShieldCheck, UserCheck]
function AgentAccessSection() {
  const t = useTranslations("landing")
  return (
    <section id="agent-access" className="scroll-mt-20 bg-slate-950 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <SectionHeading eyebrow={t("agent.eyebrow")} title={t("agent.title")} description={t("agent.subtitle")} inverse />
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-5"><span className="flex size-9 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300"><Bot className="size-5" aria-hidden="true" /></span><div><p className="text-sm font-bold text-white">{t("agent.gatewayTitle")}</p><p className="mt-0.5 text-xs text-slate-400">{t("agent.gatewayStatus")}</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {agentIcons.map((Icon, index) => <article key={index} className="rounded-xl border border-white/10 bg-slate-900 p-4"><Icon className="size-5 text-emerald-300" aria-hidden="true" /><h3 className="mt-4 text-sm font-bold text-white">{t(`agent.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{t(`agent.items.${index}.description`)}</p></article>)}
            </div>
          </div>
        </div>
        <p className="mt-7 max-w-4xl text-sm leading-6 text-slate-400">{t("agent.caveat")}</p>
      </div>
    </section>
  )
}

const capabilityIcons = [FileSearch, Sparkles, CircleDot, Workflow, Layers3, Network]
function CapabilitiesSection() {
  const t = useTranslations("landing")
  return (
    <section id="capabilities" className="scroll-mt-20 bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t("capabilities.eyebrow")} title={t("capabilities.title")} description={t("capabilities.subtitle")} />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {capabilityIcons.map((Icon, index) => <article key={index} className="bg-white p-6 sm:p-7"><div className="flex items-start justify-between gap-4"><span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800"><Icon className="size-5" aria-hidden="true" /></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${index === 1 ? "bg-amber-50 text-amber-800" : index === 4 ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800"}`}>{t(`capabilities.items.${index}.status`)}</span></div><h3 className="mt-5 text-lg font-bold text-slate-950">{t(`capabilities.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t(`capabilities.items.${index}.description`)}</p></article>)}
        </div>
        <p className="mt-6 text-sm leading-6 text-slate-500">{t("capabilities.statusNote")}</p>
      </div>
    </section>
  )
}

function SelfHostingSection() {
  const t = useTranslations("landing")
  const benefits = [ServerCog, LockKeyhole, Check]
  return (
    <section id="self-hosting" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <SectionHeading eyebrow={t("selfHost.eyebrow")} title={t("selfHost.title")} description={t("selfHost.subtitle")} />
          <ul className="mt-8 space-y-5">
            {benefits.map((Icon, index) => <li key={index} className="flex gap-4"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Icon className="size-4" aria-hidden="true" /></span><div><p className="font-bold text-slate-950">{t(`selfHost.items.${index}.title`)}</p><p className="mt-1 text-sm leading-6 text-slate-600">{t(`selfHost.items.${index}.description`)}</p></div></li>)}
          </ul>
          <Link href={SELF_HOSTING_URL} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">{t("selfHost.guide")}<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-slate-950/15">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="font-mono text-xs font-semibold text-slate-400">{t("selfHost.terminalLabel")}</span><span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="size-2 rounded-full bg-emerald-400" />AGPL-3.0</span></div>
          <pre className="overflow-x-auto p-5 text-start font-mono text-xs leading-7 text-slate-300 sm:p-7 sm:text-sm" dir="ltr"><code><span className="text-slate-500">$</span> git clone https://github.com/aaked-app/aakd.git{"\n"}<span className="text-slate-500">$</span> cd aakd{"\n"}<span className="text-slate-500">$</span> cp .env.example .env{"\n"}<span className="text-slate-500">$</span> docker compose up</code></pre>
          <p className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-400 sm:px-7">{t("selfHost.requirements")}</p>
        </div>
      </div>
    </section>
  )
}

function FAQSection() {
  const t = useTranslations("landing")
  return (
    <section id="faq" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t("faqNew.eyebrow")} title={t("faqNew.title")} description={t("faqNew.subtitle")} />
        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {[0, 1, 2, 3, 4].map((index) => <details key={index} className="group py-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 text-start font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">{t(`faqNew.items.${index}.question`)}<ChevronDown className="size-5 shrink-0 text-slate-500 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary><p className="max-w-3xl pb-6 text-sm leading-7 text-slate-600">{t(`faqNew.items.${index}.answer`)}</p></details>)}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  const t = useTranslations("landing")
  return (
    <section className="bg-emerald-900 py-16 sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="max-w-2xl"><h2 className="text-balance font-[var(--font-sora)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t("finalCta.title")}</h2><p className="mt-4 text-base leading-7 text-emerald-100">{t("finalCta.subtitle")}</p></div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900 motion-reduce:transition-none">{t("finalCta.primary")}</Link><Link href={REPOSITORY_URL} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/30 px-5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"><ExternalLink className="size-4" aria-hidden="true" />{t("finalCta.secondary")}</Link></div>
      </div>
    </section>
  )
}

function LandingFooter() {
  const t = useTranslations("landing")
  return (
    <footer className="bg-slate-950 py-12 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="max-w-sm"><AakdLogo size={30} wordmarkClassName="text-white" /><p className="mt-4 text-sm leading-6">{t("footerNew.tagline")}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-white">{t("footerNew.product")}</p><nav aria-label={t("footerNew.product")} className="mt-4 flex flex-col items-start gap-3 text-sm"><a href="#outcome" className="hover:text-white">{t("nav.outcome")}</a><a href="#agent-access" className="hover:text-white">{t("nav.agentAccess")}</a><a href="#capabilities" className="hover:text-white">{t("nav.capabilities")}</a></nav></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-white">{t("footerNew.resources")}</p><nav aria-label={t("footerNew.resources")} className="mt-4 flex flex-col items-start gap-3 text-sm"><Link href={SELF_HOSTING_URL} className="hover:text-white">{t("footerNew.selfHosting")}</Link><Link href={API_REFERENCE_URL} className="hover:text-white">{t("footerNew.api")}</Link><Link href={SECURITY_URL} className="hover:text-white">{t("footerNew.security")}</Link></nav></div>
        </div>
        <div className="flex flex-col gap-4 pt-7 text-xs sm:flex-row sm:items-center sm:justify-between"><p>{t("footerNew.copyright")}</p><Link href={REPOSITORY_URL} className="inline-flex items-center gap-2 font-semibold hover:text-white"><ExternalLink className="size-4" aria-hidden="true" />{t("footerNew.github")}</Link></div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return <div className="min-h-screen bg-white text-slate-950 [color-scheme:light]"><LandingHeader /><main><Hero /><TrustSection /><AgentAccessSection /><CapabilitiesSection /><SelfHostingSection /><FAQSection /><FinalCTA /></main><LandingFooter /></div>
}
