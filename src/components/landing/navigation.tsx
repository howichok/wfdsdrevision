"use client";

import * as React from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 rounded-2xl border transition-all duration-300",
          isScrolled
            ? "border-border/80 bg-card/90 backdrop-blur-xl shadow-lg shadow-foreground/5"
            : "border-border/40 bg-card/60 backdrop-blur-md"
        )}
      >
        <Link
          href="/welcome"
          className="flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="ReviseAI Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">
            ReviseAI
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex"
          aria-label="Primary navigation"
        >
          {[
            ["#playground-section", "Live Demo"],
            ["#features", "Features"],
            ["#how-it-works", "How It Works"],
            ["#pricing", "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground transition-colors md:block focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-lg px-2 py-1"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className={buttonVariants({
              size: "sm",
              className:
                "rounded-xl px-4 h-9 font-semibold shadow-md shadow-primary/20 hover-lift active-press",
            })}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
