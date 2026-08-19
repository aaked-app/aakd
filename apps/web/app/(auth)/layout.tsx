import type { Metadata } from "next"

import AuthShell from "./auth-shell"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
