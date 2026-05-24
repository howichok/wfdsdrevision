import { motion } from "framer-motion"
import { KaelLogo } from "@/components/kael/KaelLogo"
import { cn } from "@/lib/utils/cn"

export function KaelAvatar({
  reduceMotion,
  size = "md",
  className,
}: {
  reduceMotion?: boolean | null
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const dim =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"

  return (
    <motion.div
      className={cn("relative shrink-0", dim, className)}
      animate={reduceMotion ? undefined : { y: [0, -2, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <KaelLogo variant="mark" className="h-full w-full" />
    </motion.div>
  )
}
