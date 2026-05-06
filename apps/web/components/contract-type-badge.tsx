import { Badge } from "@/components/ui/badge"
import { ContractType } from "@/lib/types"

const typeLabels: Record<ContractType, string> = {
  NDA: "NDA",
  MSA: "MSA",
  SOW: "SOW",
  EMPLOYMENT: "Employment",
  VENDOR: "Vendor",
  CUSTOMER: "Customer",
  OTHER: "Other",
}

export function ContractTypeBadge({ type }: { type: ContractType | null | undefined }) {
  if (!type) return null
  return (
    <Badge variant="outline" className="font-normal">
      {typeLabels[type] ?? type}
    </Badge>
  )
}
