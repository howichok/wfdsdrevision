import type { ReactNode } from "react"
import "@/styles/kael.css"
import { cn } from "@/lib/utils/cn"

export function KaelShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div data-kael-shell className={cn("min-h-dvh", className)}>
      {children}
    </div>
  )
}
