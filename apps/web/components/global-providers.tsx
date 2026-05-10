"use client"

import { CommandPalette } from "@/components/command-palette"
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal"
import { OnboardingModal } from "@/components/onboarding-modal"

export function GlobalProviders() {
  return (
    <>
      <CommandPalette />
      <KeyboardShortcutsModal />
      <OnboardingModal />
    </>
  )
}

export default GlobalProviders
