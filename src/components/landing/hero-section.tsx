"use client";

import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section
      className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-12 lg:px-8"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto max-w-6xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 border border-border/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground mx-auto lg:mx-0 w-fit"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>Teams sync · Pathline · AI marking</span>
            </motion.div>

            <motion.h1
              id="hero-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-heading mb-6 text-4xl font-bold tracking-tight sm:text-6xl text-foreground leading-[1.08]"
            >
              Smarter revision.
              <br className="hidden sm:block" />
              <span className="text-gradient-brand">Higher grades.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed mx-auto lg:mx-0"
            >
              Follow your syllabus pathline chapter by chapter. Sync Teams materials,
              practice with AI-marked questions, and see exactly where to improve before exam day.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start"
            >
              <Link
                href="/login"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "h-12 rounded-md px-7 text-sm font-semibold hover-lift active-press",
                })}
              >
                Start revising free
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="#playground-section"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "h-12 rounded-md px-7 text-sm font-semibold bg-background/70 hover-lift active-press",
                })}
              >
                See live demo
              </Link>
            </motion.div>
          </div>

          <div className="lg:col-span-5 flex justify-center items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.2 }}
              className="w-full max-w-[420px]"
            >
              <div className="relative overflow-hidden border-y border-border/60 p-5 flex flex-col gap-4 bg-background/55">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-3" aria-hidden>
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                  <span className="text-[10px] font-medium text-muted-foreground ml-2">
                    reviseai.app/pathline
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 py-2">
                  {[
                    { label: "Subjects", pct: "100%", done: true },
                    { label: "Biology", pct: "100%", done: true },
                    { label: "Mitochondria", pct: "76%", done: false, active: true },
                    { label: "Ecology", pct: "0%", done: false },
                  ].map((node) => (
                    <div key={node.label} className="flex flex-col items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                          node.active
                            ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_oklch(0.58_0.12_175_/_0.35)]"
                            : node.done
                              ? "border-emerald-500 bg-emerald-500/90 text-white"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {node.pct}
                      </div>
                      <span className="text-[9px] font-semibold text-muted-foreground truncate w-full text-center">
                        {node.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-muted/35 border-y border-border/60 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground text-sm mb-1">Current chapter · Mitochondria</p>
                  ATP production, cell respiration, membrane structure
                </div>

                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute -bottom-2 -left-2 border border-border/60 bg-background/85 px-3 py-2 flex items-center gap-2 z-10"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-foreground block">Syllabus mastery</span>
                    <span className="text-[9px] text-primary font-semibold">+12% this week</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
