import { redirect } from "next/navigation"

/** Templates are paused while the core upload, review, and obligations flow is stabilized. */
export default function TemplatesPausedLayout({ children }: { children: React.ReactNode }) {
  void children
  redirect("/dashboard")
}
