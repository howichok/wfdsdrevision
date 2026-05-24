"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { AlertCircle, Loader2, BookOpen, CheckCircle, Activity } from "lucide-react";
import { NodeActionModal } from "./NodeActionModal";
import { motion } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  lessonId: string;
  lessonTitle: string | null;
  nodeType: string;
  key: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  masteryScore: number;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  core_concept: "Core Concept",
  prerequisite: "Prerequisite",
  syntax_rule: "Syntax Rule",
  common_pitfall: "Common Pitfall",
};

// ─── Data fetcher ─────────────────────────────────────────────────────────────
async function fetchGraphNodes(): Promise<{ nodes: GraphNode[] }> {
  const res = await fetch("/api/graph/nodes", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load graph");
  return res.json() as Promise<{ nodes: GraphNode[] }>;
}

// ─── Count Up Animation for Statistics ───────────────────────────────────────
function AnimatedStatNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setDisplayValue(end);
      return;
    }
    const duration = 800; // 0.8 seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      // Ease out quad
      const ease = progress * (2 - progress);
      const currentVal = Math.round(start + (end - start) * ease);
      setDisplayValue(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue}</span>;
}

// ─── Animation Variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export function KnowledgeCanvas() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // ── Data ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["graph-nodes"],
    queryFn: fetchGraphNodes,
    staleTime: 60_000,
  });

  const nodes = data?.nodes ?? [];

  // Group concepts by lesson
  const lessons = useMemo(() => {
    const map = new Map<string, { title: string; nodes: GraphNode[] }>();
    for (const n of nodes) {
      const lessonId = n.lessonId || "general";
      const title = n.lessonTitle || "General Curriculum Concepts";
      if (!map.has(lessonId)) {
        map.set(lessonId, { title, nodes: [] });
      }
      map.get(lessonId)!.nodes.push(n);
    }
    return Array.from(map.values());
  }, [nodes]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = nodes.length;
    const mastered = nodes.filter((n) => n.masteryScore >= 85).length;
    const progressing = nodes.filter((n) => n.masteryScore >= 50 && n.masteryScore < 85).length;
    const gaps = nodes.filter((n) => n.masteryScore < 50).length;
    return { total, mastered, progressing, gaps };
  }, [nodes]);

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-[450px] w-full items-center justify-center bg-white border border-slate-200/80 rounded-2xl shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold">Loading curriculum directory…</p>
        </div>
      </motion.div>
    );
  }

  if (isError) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-[400px] w-full items-center justify-center bg-white border border-slate-200/80 rounded-2xl shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 text-slate-500 text-center px-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-slate-800">Failed to load curriculum data.</p>
        </div>
      </motion.div>
    );
  }

  if (nodes.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-[400px] w-full items-center justify-center bg-white border border-slate-200/80 rounded-2xl shadow-sm"
      >
        <div className="flex max-w-sm flex-col items-center gap-4 text-center px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 border border-slate-200">
            <BookOpen className="h-6 w-6 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">No Revision Concepts Yet</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Create and study lessons to automatically extract syllabus concepts. They will appear here organized in a study checklist directory.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HUD / Summary Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Concepts", value: stats.total, icon: BookOpen, color: "text-blue-600 bg-blue-50/50", border: "border-slate-200" },
          { label: "Mastered (≥85%)", value: stats.mastered, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50/50", border: "border-slate-200" },
          { label: "Progressing (50-84%)", value: stats.progressing, icon: Activity, color: "text-blue-600 bg-blue-50/50", border: "border-slate-200" },
          { label: "Critical Gaps (<50%)", value: stats.gaps, icon: AlertCircle, color: "text-rose-600 bg-rose-50/50", border: "border-slate-200" }
        ].map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring" as const, stiffness: 100, damping: 15, delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`bg-white border ${stat.border} rounded-2xl p-4 shadow-sm flex items-center gap-4 transition-all duration-200 hover:shadow-md cursor-default`}
            >
              <div className={`p-3 rounded-full ${stat.color} shrink-0`}>
                <IconComponent className="h-5 w-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">{stat.label}</p>
                <motion.p 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring" as const, stiffness: 100, damping: 12, delay: i * 0.05 + 0.1 }}
                  className="text-xl font-bold mt-0.5 text-slate-800"
                >
                  <AnimatedStatNumber value={stat.value} />
                </motion.p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Directory Content */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {lessons.map((lesson, index) => (
          <motion.div 
            key={index} 
            variants={itemVariants}
            className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            {/* Lesson Title Header */}
            <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/40">
                  <BookOpen className="h-4 w-4" />
                </div>
                {lesson.title}
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 rounded-full px-2.5 py-0.5 border border-slate-300/10">
                {lesson.nodes.length} {lesson.nodes.length === 1 ? "Concept" : "Concepts"}
              </span>
            </div>

            {/* Concepts List */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              className="p-5 space-y-3 bg-slate-50/30"
            >
              {lesson.nodes.map((node) => {
                const typeLabel = NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType;
                
                let scoreBadgeClass = "bg-rose-50 border-rose-100 text-rose-700";
                let barColorClass = "bg-rose-500";
                if (node.masteryScore >= 85) {
                  scoreBadgeClass = "bg-emerald-50 border-emerald-100 text-emerald-700";
                  barColorClass = "bg-emerald-500";
                } else if (node.masteryScore >= 50) {
                  scoreBadgeClass = "bg-blue-50 border-blue-100 text-blue-700";
                  barColorClass = "bg-blue-500";
                }

                return (
                  <motion.div 
                    key={node.id} 
                    variants={itemVariants}
                    whileHover={{ scale: 1.005, y: -1, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)" }}
                    whileTap={{ scale: 0.995 }}
                    onClick={() => setSelectedNode(node)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white border border-slate-100 hover:border-slate-200 rounded-2xl transition-all duration-200 cursor-pointer"
                  >
                    {/* Left: Metadata and concept name */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100/80 rounded-full px-2.5 py-0.5">
                          {typeLabel}
                        </span>
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${scoreBadgeClass}`}>
                          {node.masteryScore}% Recall
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">{node.key}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                        {node.summary}
                      </p>
                    </div>

                    {/* Center: Progress bar */}
                    <div className="w-full md:w-48 shrink-0 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                        <span>Mastery Progress</span>
                        <span className="font-semibold text-slate-700">{node.masteryScore}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-200/60 p-[1px]">
                        <motion.div 
                          className={`h-full rounded-full ${barColorClass}`} 
                          initial={{ width: 0 }}
                          whileInView={{ width: `${node.masteryScore}%` }}
                          viewport={{ once: true }}
                          transition={{ type: "spring" as const, stiffness: 60, damping: 15 }}
                        />
                      </div>
                    </div>

                    {/* Right: Study CTA Button */}
                    <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                      <motion.button
                        onClick={() => setSelectedNode(node)}
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring" as const, stiffness: 450, damping: 15 }}
                        className="w-full md:w-auto px-5 py-2.5 border border-slate-250 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-full font-bold text-xs hover-lift active-press shadow-sm hover:shadow transition-all cursor-pointer"
                      >
                        Study & Practice
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Node action drawer / modal ── */}
      <NodeActionModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
