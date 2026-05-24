"use client";

import { motion } from "framer-motion";
import { CloudLightning, Lock, LineChart, Route } from "lucide-react";

const features = [
  {
    title: "Teams classroom sync",
    description:
      "Pull lesson posts, PDFs, and announcements from Microsoft Teams into your private revision workspace automatically.",
    icon: CloudLightning,
    className: "md:col-span-2",
    accent: "from-primary/10 to-transparent",
  },
  {
    title: "Revision pathline",
    description:
      "Visual syllabus journey — chapters unlock as you progress, with live completion percentages.",
    icon: Route,
    className: "md:col-span-1",
    accent: "from-emerald-500/10 to-transparent",
  },
  {
    title: "Secure exam mode",
    description:
      "Distraction-free lockdown workspace for mock papers graded against your specification rubric.",
    icon: Lock,
    className: "md:col-span-1",
    accent: "from-rose-500/10 to-transparent",
  },
  {
    title: "AI diagnostics",
    description:
      "Semantic marking plus a mastery gap dashboard — see topics below 70% and what to revise next.",
    icon: LineChart,
    className: "md:col-span-2",
    accent: "from-amber-500/10 to-transparent",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 16 } },
} as const;

export function BentoFeatures() {
  return (
    <section id="features" className="py-18 px-6 sm:py-24 border-t border-border/45" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Features</p>
          <h2
            id="features-heading"
            className="font-heading mb-4 text-3xl font-bold tracking-tight sm:text-4xl text-foreground"
          >
            Engineered for exam success
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Everything you need to revise smarter — from synced materials to AI feedback and visual progress tracking.
          </p>
        </div>

        <motion.ul
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 gap-0 md:grid-cols-3 border-y border-border/45"
          role="list"
        >
          {features.map((feature) => (
            <motion.li
              key={feature.title}
              variants={item}
              className={`group relative p-8 border-b border-border/45 md:border-b-0 md:border-r md:border-border/45 last:border-r-0 ${feature.className}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-60 pointer-events-none`}
              />
              <div className="relative">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                  <feature.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-heading mb-2 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
