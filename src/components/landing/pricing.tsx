"use client";

import React from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const tiers = [
  {
    name: "Free Tier",
    price: "$0",
    description: "Core revision tools to help you get started.",
    features: [
      "3 AI classroom summaries / month",
      "3 custom practice exams / month",
      "Standard AI Tutor chat guidance",
      "Manual content copy-paste inputs",
      "Basic diagnostic grade logs"
    ],
    buttonText: "Start Revision Free",
    href: "/login",
    isFeatured: false
  },
  {
    name: "Revision Pro",
    price: "$9.99",
    description: "The complete, automated exam preparation suite.",
    features: [
      "Unlimited AI classroom summaries",
      "Unlimited custom practice exams",
      "Socratic & Standard Tutor Chat toggles",
      "Real-time MS Teams Classroom Sync",
      "AI error memory gap analysis",
      "Drag-and-drop code sorting games",
      "Priority AI queue response times"
    ],
    buttonText: "Upgrade to Revision Pro",
    href: "/login",
    isFeatured: true
  }
];

export function Pricing() {
  return (
    <section 
      id="pricing" 
      className="py-20 px-6 sm:py-28" 
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 id="pricing-heading" className="mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600">
            Choose the plan that fits your study needs. Access your study dashboard instantly.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {tiers.map((tier) => (
            <div 
              key={tier.name}
              className={`relative rounded-3xl border p-8 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] ${
                tier.isFeatured 
                  ? "border-slate-300 bg-white shadow-[0_12px_40px_-8px_rgba(10,53,108,0.08)] hover:border-slate-400 ring-1 ring-slate-100/50"
                  : "border-slate-250 bg-white/80 hover:border-slate-350 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)]"
              }`}
            >
              {tier.isFeatured && (
                <div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-[#0a356c] px-4 py-1 text-xs font-bold text-white shadow-sm"
                  aria-hidden="true"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Recommended
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {tier.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-655">
                    {tier.description}
                  </p>
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {tier.price}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">
                    /month
                  </span>
                </div>
                
                <ul className="space-y-3.5 border-t border-slate-200/60 pt-6" role="list">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div 
                        className={`mt-0.5 rounded-full p-0.5 shrink-0 flex items-center justify-center border ${
                          tier.isFeatured 
                            ? "bg-indigo-50 text-indigo-650 border-indigo-100" 
                            : "bg-slate-50 text-slate-600 border-slate-100"
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm text-slate-700">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/60">
                <Link
                  href={tier.href}
                  className={buttonVariants({
                    variant: tier.isFeatured ? "default" : "outline",
                    className: `w-full h-11 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none ${
                      tier.isFeatured 
                        ? "bg-[#0a356c] hover:bg-[#072a56] text-white shadow-xs" 
                        : "bg-white border border-slate-205 hover:border-slate-350 hover:bg-slate-50 text-slate-700"
                    }`
                  })}
                  aria-label={`${tier.buttonText} - ${tier.name}`}
                >
                  {tier.buttonText}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
