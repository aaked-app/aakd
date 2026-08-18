import nodemailer from "nodemailer"

export interface ActionDeliveryEmailParams {
  to: string
  recipientName: string
  actionTitle: string
  actionUrl: string
  contractTitle: string
  dueDate: string | null
  sourceText: string | null
  sourcePage: number | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendActionDeliveryEmail(params: ActionDeliveryEmailParams): Promise<void> {
  if (!process.env.SMTP_HOST) throw new Error("smtp_not_configured")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  const deepLink = new URL(params.actionUrl, appUrl).toString()
  const citation = params.sourceText
    ? `<blockquote style="margin:20px 0;padding:12px 16px;border-left:3px solid #4f46e5;background:#f8fafc">${escapeHtml(params.sourceText)}${params.sourcePage ? ` <span style="color:#64748b">(page ${params.sourcePage})</span>` : ""}</blockquote>`
    : ""
  const dueDate = params.dueDate
    ? `<p style="margin:8px 0"><strong>Due:</strong> ${escapeHtml(params.dueDate.slice(0, 10))}</p>`
    : ""

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@aakd.io",
    to: params.to,
    subject: `[Aakd] Action assigned — ${params.actionTitle}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto"><p>Hello ${escapeHtml(params.recipientName)},</p><h2>${escapeHtml(params.actionTitle)}</h2><p><strong>Contract:</strong> ${escapeHtml(params.contractTitle)}</p>${dueDate}${citation}<p><a href="${escapeHtml(deepLink)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#4f46e5;color:#fff;text-decoration:none">Review action</a></p><p style="color:#64748b;font-size:12px">This message was explicitly sent by a workspace member. Review the cited source in Aakd before acting.</p></div>`,
  })
}
