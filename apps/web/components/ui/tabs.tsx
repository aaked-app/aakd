"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  const isHorizontal = orientation !== "vertical"
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      {...(isHorizontal ? { "data-horizontal": "" } : { "data-vertical": "" })}
      className={cn(
        "group/tabs flex gap-2",
        isHorizontal ? "flex-col" : "flex-row",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] group-data-[horizontal]/tabs:h-8 group-data-[vertical]/tabs:h-fit group-data-[vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-zinc-500",
        line: "gap-1 bg-transparent text-zinc-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-zinc-500 transition-all group-data-[vertical]/tabs:w-full group-data-[vertical]/tabs:justify-start hover:text-zinc-900 focus-visible:border-indigo-500 focus-visible:ring-[3px] focus-visible:ring-indigo-500/20 focus-visible:outline-1 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-white data-active:text-zinc-900",
        "group-data-[variant=line]/tabs-list:data-active:text-indigo-600",
        "after:absolute after:opacity-0 after:transition-opacity group-data-[horizontal]/tabs:after:inset-x-0 group-data-[horizontal]/tabs:after:bottom-[-5px] group-data-[horizontal]/tabs:after:h-0.5 group-data-[vertical]/tabs:after:inset-y-0 group-data-[vertical]/tabs:after:-right-1 group-data-[vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100 after:bg-indigo-600",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
