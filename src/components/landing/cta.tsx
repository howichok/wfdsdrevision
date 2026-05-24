"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="relative overflow-hidden py-16 px-6 sm:py-22 border-y border-border/45" aria-label="Get started">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden text-center p-8 sm:p-12 bg-background/40">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-amber-500/5 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 border border-border/60 bg-muted/35 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              Free to start · No card required
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl text-foreground mb-4">
              Ready to follow your pathline?
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground mb-8 leading-relaxed">
              Create an account in seconds, sync your classroom, and start revising with AI feedback today.
            </p>
            <Link
              href="/login"
              className={buttonVariants({
                size: "lg",
                className:
                  "h-12 rounded-md px-8 font-semibold hover-lift active-press",
              })}
            >
              Get started free
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
