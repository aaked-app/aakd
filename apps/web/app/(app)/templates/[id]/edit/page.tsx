"use client"

import { useParams } from "next/navigation"
import { TemplateEditorPage } from "@/components/templates/template-editor-page"

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>()
  return <TemplateEditorPage templateId={id} />
}
