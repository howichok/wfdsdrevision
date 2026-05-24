"use client";

import React from "react";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How does Microsoft Teams Sync work?",
    answer: "Once linked, our system securely syncs with your Microsoft Teams classroom. It scans channels for new announcements, lecture slide files, and PDFs uploaded by your teachers. It then automatically parses these documents, maps them into concept nodes, and creates practice recall questions so you don't have to copy-paste anything manually."
  },
  {
    question: "What is the difference between Standard and Socratic Tutor modes?",
    answer: "Standard mode functions like a helpful assistant that answers your revision questions directly and sums up topics. Socratic mode acts as a teacher—it refrains from giving you the answer directly, instead guiding you through a series of questions that prompt you to figure it out yourself, significantly improving memory recall."
  },
  {
    question: "How does Secure Exam Practice Mode lock down my workspace?",
    answer: "When active, Secure Exam Mode locks you into a full-screen, distraction-free environment. Sidebars and extra navigation tabs are hidden, forcing you to focus entirely on the exam questions. Your progress is saved locally, and your answers are graded semantically against strict rubric standards once submitted."
  },
  {
    question: "Where is my revision data stored?",
    answer: "Revise AI uses a local-first offline storage model. Your revision workspace drafts, code sorted game states, and notes are saved directly in your browser's IndexedDB. When you go online, these details are safely synced to our secure server database, ensuring you never lose your progress."
  }
];

export function FAQ() {
  return (
    <section 
      id="faq" 
      className="py-20 px-6 sm:py-28 bg-transparent border-t border-slate-200/80"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <div 
            className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700 border border-slate-200"
            aria-hidden="true"
          >
            <HelpCircle className="h-5 w-5" />
          </div>
          <h2 id="faq-heading" className="mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-600">
            Everything you need to know about setting up your revision workspace.
          </p>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <details 
              key={index}
              className="group border border-slate-200 bg-white/70 backdrop-blur-xs rounded-2xl overflow-hidden transition-all duration-350 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)] hover:border-slate-300 [&_summary::-webkit-details-marker]:hidden [&_summary::marker]:hidden"
            >
              <summary 
                className="flex items-center justify-between p-6 text-base font-bold text-slate-800 cursor-pointer list-none hover:text-slate-950 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-305"
              >
                <span>{faq.question}</span>
                <span 
                  className="ml-4 flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-transform duration-300 group-open:rotate-180"
                  aria-hidden="true"
                >
                  ↓
                </span>
              </summary>
              <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50">
                <p className="text-sm sm:text-base text-slate-605 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
