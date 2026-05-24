import type { Metadata } from "next";
import { KnowledgeCanvas } from "@/components/dashboard/KnowledgeCanvas";

export const metadata: Metadata = {
  title: "Curriculum Checklist — Student Revision Portal",
  description: "Checklist directory of all curriculum concepts and student mastery scores.",
};

export default function CanvasPage() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Curriculum Checklist</h1>
        <p className="text-sm text-slate-500">
          Track your semantic recall and mastery score for each syllabus concept.
        </p>
      </div>
      <KnowledgeCanvas />
    </div>
  );
}
