"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sparkles, FileText, Plug, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface StepMeta {
  icon: React.ComponentType<{ className?: string }>
  key: "welcome" | "contract" | "tools" | "team"
}

const STEPS: StepMeta[] = [
  { icon: Sparkles, key: "welcome" },
  { icon: FileText, key: "contract" },
  { icon: Plug, key: "tools" },
  { icon: Users, key: "team" },
]

const STORAGE_KEY = "cf_onboarding_done"

export function OnboardingModal() {
  const t = useTranslations("onboarding.modal")
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (pathname === "/onboarding") {
      setVisible(false)
      return
    }

    if (typeof window !== "undefined") {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) {
        setVisible(true)
      }
    }
  }, [pathname])

  function close() {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      close()
    }
  }

  // The dedicated onboarding page owns the first-run flow. Hide the compact
  // tour synchronously during navigation so it cannot intercept its controls.
  if (!visible || pathname === "/onboarding") return null

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={visible}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-lg gap-0 overflow-hidden p-0"
      >
        <div className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-14 sm:w-14">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </div>
          <DialogHeader className="mt-5 items-center gap-2 text-center">
            <DialogTitle className="text-xl font-semibold leading-tight sm:text-2xl">
              {t(`steps.${current.key}.title`)}
            </DialogTitle>
            <DialogDescription className="max-w-sm text-sm leading-6">
              {t(`steps.${current.key}.description`)}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground">
              {t("progress", { current: step + 1, total: STEPS.length })}
            </p>
            <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
              {STEPS.map((item, index) => (
                <span
                  key={item.key}
                  className={
                    index === step
                      ? "h-1.5 w-6 rounded-full bg-primary transition-all"
                      : "h-1.5 w-1.5 rounded-full bg-muted transition-all"
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="m-0 flex-col gap-2 rounded-none border-t bg-muted/20 p-4 sm:m-0 sm:flex-row sm:justify-between sm:p-5">
          <Button type="button" variant="ghost" onClick={close} className="h-11 w-full sm:w-auto">
            {t("actions.skip")}
          </Button>
          <Button type="button" onClick={next} className="h-11 w-full sm:w-auto sm:min-w-28">
            {isLast ? t("actions.getStarted") : t("actions.next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OnboardingModal
