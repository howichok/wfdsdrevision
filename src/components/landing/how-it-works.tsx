"use client";

import React from "react";
import { CloudLightning, MessageSquare, Play, LineChart } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Sync Class Materials",
    description: "Link your Microsoft Teams workspace. Revise AI instantly syncs class documents, lecture slides, and posts to build custom revision sets.",
    icon: CloudLightning,
    badge: "Automated Integration"
  },
  {
    number: "02",
    title: "AI Classroom Tutoring",
    description: "Study structured course summaries and interact with the AI Tutor. Enable Socratic Mode to get guided hints instead of plain answers.",
    icon: MessageSquare,
    badge: "Interactive Chat"
  },
  {
    number: "03",
    title: "Practice & Exam Lockdown",
    description: "Practice drag-and-drop code block sorting games or take full-length custom mock exams in a distraction-free secure lockdown layout.",
    icon: Play,
    badge: "Robust Assessments"
  },
  {
    number: "04",
    title: "Diagnostics & Mastery Gaps",
    description: "View real-time graded scores. Concepts with mastery scores below 50% are automatically highlighted on your study plan dashboard.",
    icon: LineChart,
    badge: "AI Performance Gaps"
  }
];

export function HowItWorks() {
  return (
    <section 
      id="how-it-works" 
      className="py-20 px-6 sm:py-28 bg-transparent border-y border-slate-200/80"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 id="how-it-works-heading" className="mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600">
            A step-by-step workflow designed to take you from unorganized classroom feeds to full exam mastery in one unified dashboard.
          </p>
        </div>

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
          {steps.map((step) => (
            <li 
              key={step.number}
              className="group relative rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.08)] hover:shadow-[0_8px_30px_-4px_rgba(148,163,184,0.16)] hover:border-slate-300 transition-all duration-300 focus-within:ring-2 focus-within:ring-slate-400 focus-within:outline-none"
            >
              <div className="flex flex-col h-full justify-between gap-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-4xl font-black text-slate-200 group-hover:text-slate-300 transition-colors font-mono"
                      aria-hidden="true"
                    >
                      {step.number}
                    </span>
                    <div 
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-700 shadow-sm"
                      aria-hidden="true"
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                  </div>
                  
                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {step.title}
                  </h3>
                  
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div>
                  <span 
                    className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700"
                  >
                    {step.badge}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
