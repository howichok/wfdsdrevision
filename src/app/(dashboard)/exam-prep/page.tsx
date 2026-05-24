"use client";

import { useState } from "react";
import { Play, FileText } from "lucide-react";
import { ExamWorkspace } from "./exam-workspace";

export default function ExamPrepPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedLength, setSelectedLength] = useState<string | null>(null);

  const practiceExams = [
    {
      id: "exam-1",
      title: "Computer Science Paper 1: Relational Databases & SQL",
      duration: "60 mins",
      totalPoints: 80,
      difficulty: "medium",
      attempts: 2,
      maxScore: 88,
    },
    {
      id: "exam-2",
      title: "Data Anomalies & Database Normalization Masterclass",
      duration: "45 mins",
      totalPoints: 60,
      difficulty: "hard",
      attempts: 0,
      maxScore: null,
    },
    {
      id: "exam-3",
      title: "ER Diagrams & Logical Database Design Concepts",
      duration: "30 mins",
      totalPoints: 40,
      difficulty: "easy",
      attempts: 1,
      maxScore: 95,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Exam Preparation</h1>
        <p className="text-sm text-muted-foreground">
          Prepare for your board assessments. Take mock papers or generate a personalised AI exam based on your weak areas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Past exam papers list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Past Practice Papers
          </h2>

          <div className="space-y-3">
            {practiceExams.map((exam) => (
              <div
                key={exam.id}
                className="group relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:bg-slate-50 hover-lift shadow-sm transition-all duration-300"
              >
                <h3 className="font-heading text-sm font-bold leading-snug text-slate-800">
                  {exam.title}
                </h3>

                <button
                  onClick={() => {
                    setSelectedTopic(exam.title);
                    const lengthStr = exam.duration === "60 mins"
                      ? "Full Exam Mock (60 mins / 80 pts)"
                      : exam.duration === "45 mins"
                      ? "Standard Lab Practice (30 mins / 40 pts)"
                      : "Quick Check (15 mins / 20 pts)";
                    setSelectedLength(lengthStr);
                  }}
                  className="flex-shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 hover-lift active-press transition-all shadow-sm cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-current" />
                  Start Exam
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Interactive AI Exam Workspace */}
        <div>
          <ExamWorkspace
            externalTopic={selectedTopic || undefined}
            externalLength={selectedLength || undefined}
            onClearExternal={() => {
              setSelectedTopic(null);
              setSelectedLength(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
