import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-base text-zinc-900 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-700 placeholder:text-zinc-400 focus-visible:border-indigo-500 focus-visible:ring-3 focus-visible:ring-indigo-500/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
