import { cn } from "@/lib/utils/cn"

type KaelLogoVariant = "full" | "mark"

const VIEWBOX: Record<KaelLogoVariant, string> = {
  full: "0 0 800 500",
  mark: "240 40 480 420",
}

export function KaelLogo({
  variant = "full",
  className,
}: {
  variant?: KaelLogoVariant
  className?: string
}) {
  return (
    <svg
      className={cn("kael-logo h-auto w-full", className)}
      viewBox={VIEWBOX[variant]}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g stroke="none">
        <g>
          <polygon points="250,30 250,250 350,150" fill="var(--kael-logo-1)" />
          <polygon points="250,30 350,150 420,250" fill="var(--kael-logo-2)" />
          <polygon points="250,470 250,250 350,350" fill="var(--kael-logo-1)" />
          <polygon points="250,470 350,350 420,250" fill="var(--kael-logo-2)" />
          <polygon points="250,250 350,150 420,250" fill="var(--kael-logo-3)" />
          <polygon points="250,250 350,350 420,250" fill="var(--kael-logo-4)" />
        </g>

        <g>
          <polygon points="300,250 430,160 430,250" fill="var(--kael-logo-4)" />
          <polygon points="300,250 430,340 430,250" fill="var(--kael-logo-5)" />
          <polygon points="430,160 550,30 550,180" fill="var(--kael-logo-6)" />
          <polygon points="430,160 430,250 550,180" fill="var(--kael-logo-7)" />
          <polygon points="550,30 750,30 630,250" fill="var(--kael-logo-5)" />
          <polygon points="550,30 550,180 630,250" fill="var(--kael-logo-6)" />
          <polygon points="430,340 550,470 550,320" fill="var(--kael-logo-7)" />
          <polygon points="430,340 430,250 550,320" fill="var(--kael-logo-8)" />
          <polygon points="550,470 750,470 630,250" fill="var(--kael-logo-6)" />
          <polygon points="550,470 550,320 630,250" fill="var(--kael-logo-10)" />
        </g>
      </g>
    </svg>
  )
}
