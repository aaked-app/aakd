"use client"

import { Check, FileText, ShieldCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { AakdLogo } from "@/components/aakd-logo"

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth.shell")
  const locale = useLocale()
  const steps = [t("stepAccount"), t("stepWorkspace"), t("stepAgreement")]

  return (
    <div
      data-testid="auth-workspace-frame"
      className="min-h-screen bg-[#f5f4ef] text-zinc-950"
      dir={locale.startsWith("ar") ? "rtl" : "ltr"}
    >
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-rows-[auto_1fr] lg:grid-cols-[minmax(320px,0.78fr)_minmax(520px,1.22fr)] lg:grid-rows-1">
        <aside
          aria-label={t("asideLabel")}
          className="border-b border-zinc-200 px-5 py-5 sm:px-8 lg:flex lg:flex-col lg:justify-between lg:border-b-0 lg:border-e lg:px-12 lg:py-10"
        >
          <div>
            <AakdLogo size={36} wordmarkClassName="text-xl text-zinc-950" />
            <div className="mt-10 hidden max-w-md lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">{t("eyebrow")}</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em]">{t("title")}</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-600">{t("description")}</p>
            </div>
          </div>

          <div className="hidden lg:block">
            <ol aria-label={t("progressLabel")} className="space-y-0 border-s border-zinc-300">
              {steps.map((step, index) => (
                <li key={step} className="relative flex min-h-14 items-center gap-3 ps-6 text-sm">
                  <span className="absolute -start-[11px] flex size-5 items-center justify-center rounded-full border border-zinc-300 bg-[#f5f4ef] text-[10px] font-semibold text-zinc-600">
                    {index === 0 ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={index === 0 ? "font-medium text-zinc-950" : "text-zinc-500"}>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex items-start gap-3 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-800" aria-hidden="true" />
              <p>{t("controlNote")}</p>
            </div>
          </div>
        </aside>

        <main className="flex items-start justify-center px-4 py-8 sm:px-8 sm:py-16 lg:items-center lg:bg-white lg:px-12 lg:py-8">
          <div className="w-full max-w-[440px]">
            <div className="mb-5 flex items-center gap-2 text-xs font-medium text-zinc-500 lg:hidden">
              <FileText className="size-4 text-emerald-800" aria-hidden="true" />
              {t("mobileContext")}
            </div>
            <div className="border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)] sm:p-8">
              {children}
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-zinc-500">{t("footer")}</p>
          </div>
        </main>
      </div>
    </div>
  )
}
