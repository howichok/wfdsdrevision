import { db } from "@/lib/db";
import {
  topics,
  questions,
  submissions,
  teamsMessages,
  lessonRecallNodes,
  userErrorMemory,
} from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle,
  CloudLightning,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Brain,
  ArrowRight,
  Code2,
  ShieldAlert,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateObject } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";
import { z } from "zod";
import ActiveDraftsClient from "@/components/dashboard/ActiveDraftsClient";
import NoticeBoardAndFlashcards from "@/components/dashboard/NoticeBoardAndFlashcards";
import DashboardClient from "@/components/dashboard/dashboard-client";

// ─── Schema for Weakness Analysis ─────────────────────────────────────────────
const WeaknessPlanSchema = z.object({
  summary: z.string().describe("One sentence overall assessment of the student's current performance"),
  weakAreas: z.array(
    z.object({
      topic: z.string(),
      reason: z.string().describe("Why this is a weakness based on low scores"),
      action: z.string().describe("A specific, actionable study recommendation"),
    })
  ).describe("Up to 3 weak areas with targeted recommendations"),
  encouragement: z.string().describe("A short motivating message for the student"),
});

type WeaknessPlan = z.infer<typeof WeaknessPlanSchema>;

async function getWeaknessAnalysis(scoreData: { topicTitle: string; avgScore: number }[]): Promise<WeaknessPlan | null> {
  if (scoreData.length === 0) return null;
  try {
    const { object } = await generateObject({
      model: geminiFlash,
      schema: WeaknessPlanSchema,
      prompt: `Analyze this student's revision performance data and identify weaknesses:\n\n${scoreData
        .map((s) => `- ${s.topicTitle}: average score ${s.avgScore}%`)
        .join("\n")}\n\nFocus on topics below 70%. Generate an actionable personalized study plan.`,
      system: "You are a supportive academic coach analyzing student performance to create personalized study plans.",
    });
    return object;
  } catch {
    return null;
  }
}

// ─── Difficulty Label Palettes ────────────────────────────────────────────────
const NODE_TYPE_LABELS: Record<string, string> = {
  core_concept: "Core Concept",
  syntax_rule: "Syntax Rule",
  prerequisite: "Prerequisite",
  common_pitfall: "Common Pitfall",
};

const NODE_TYPE_PALETTE: Record<string, string> = {
  core_concept: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
  syntax_rule: "bg-violet-500/10 text-violet-400 border-violet-500/25",
  prerequisite: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  common_pitfall: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

// Make this route dynamic so it queries the DB on each load
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // ─── DB Variables & Seed Fallbacks ─────────────────────────────────────────
  let syncedCount = 0;
  let totalQuestions = 0;
  let attemptedCount = 0;
  let averageScore: number | null = null;
  
  let syncsList: any[] = [];
  let subsList: any[] = [];
  let gapsList: any[] = [];
  let scoreData: { topicTitle: string; avgScore: number }[] = [];

  let dbOk = false;

  try {
    const [subCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions);
    attemptedCount = subCount?.count || 0;

    const [avgScore] = await db
      .select({ avg: sql<number>`avg(score)::float` })
      .from(submissions)
      .where(eq(submissions.status, "marked"));
    if (avgScore && avgScore.avg !== null) {
      averageScore = Math.round(avgScore.avg * 10) / 10;
    }

    const [qCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions);
    totalQuestions = qCount?.count || 0;

    const [teamsMsgCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamsMessages);
    syncedCount = teamsMsgCount?.count || 0;

    // Fetch lists
    const dbSyncs = await db.query.teamsMessages.findMany({
      orderBy: [desc(teamsMessages.createdAt)],
      limit: 5,
    });
    syncsList = dbSyncs;

    const dbSubmissions = await db.query.submissions.findMany({
      orderBy: [desc(submissions.createdAt)],
      limit: 5,
    });

    const submissionsWithDetails = await Promise.all(
      dbSubmissions.map(async (s) => {
        const q = await db.query.questions.findFirst({
          where: eq(questions.id, s.questionId),
        });
        return { ...s, question: q };
      })
    );
    subsList = submissionsWithDetails;

    // Fetch weak score topics
    const allTopics = await db.query.topics.findMany({ limit: 20 });
    for (const topic of allTopics) {
      const topicQuestions = await db.query.questions.findMany({
        where: eq(questions.topicId, topic.id),
      });
      const qIds = topicQuestions.map((q) => q.id);
      const topicSubs = submissionsWithDetails.filter(
        (s) => s.status === "marked" && s.score !== null && qIds.includes(s.questionId)
      );
      if (topicSubs.length > 0) {
        const avg = topicSubs.reduce((sum, s) => sum + (s.score || 0), 0) / topicSubs.length;
        scoreData.push({ topicTitle: topic.title, avgScore: Math.round(avg) });
      }
    }

    // Fetch learning gaps
    const gapRows = await db
      .select({
        id: lessonRecallNodes.id,
        lessonId: lessonRecallNodes.lessonId,
        nodeType: lessonRecallNodes.nodeType,
        key: lessonRecallNodes.key,
        summary: lessonRecallNodes.summary,
        masteryScore: userErrorMemory.masteryScore,
      })
      .from(lessonRecallNodes)
      .leftJoin(userErrorMemory, eq(lessonRecallNodes.key, userErrorMemory.concept))
      .limit(10);

    gapsList = gapRows
      .map((r) => ({ ...r, masteryScore: r.masteryScore ?? 0 }))
      .filter((r) => r.masteryScore < 50);

    dbOk = true;
  } catch (err) {
    console.warn("Database connection issue in DashboardPage. Activating rich UI mock fallbacks:", err);
  }

  // ─── High-Fidelity Mock Fallback Hydration ──────────────────────────────────
  if (!dbOk || syncsList.length === 0) {
    syncedCount = 6;
    totalQuestions = 15;
    attemptedCount = 3;
    averageScore = 65.5;

    syncsList = [
      {
        id: "fallback-sync-1",
        sender: "Prof. Sarah Jenkins",
        content: "CS102 Database Design: Relational schema model and key constraint rules uploaded.",
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        isProcessed: true,
      },
      {
        id: "fallback-sync-2",
        sender: "Prof. Sarah Jenkins",
        content: "Quiz 3 Syllabus: 1NF, 2NF, 3NF and Boyce-Codd Normal Form (BCNF) requirements.",
        createdAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
        isProcessed: true,
      },
      {
        id: "fallback-sync-3",
        sender: "T.A. Alex Rivera",
        content: "Socratic Coding Lab: Python SQLite interface instructions & connection rules.",
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        isProcessed: false,
      },
    ];

    subsList = [
      {
        id: "fallback-sub-1",
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        score: 78,
        status: "marked",
        question: { title: "SQL Constraints & Entity Integrity" },
      },
      {
        id: "fallback-sub-2",
        createdAt: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
        score: 55,
        status: "marked",
        question: { title: "Database Normalization (3NF & Lossless Join)" },
      },
      {
        id: "fallback-sub-3",
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        score: 62,
        status: "marked",
        question: { title: "Entity-Relationship Cardinality Constraints" },
      },
    ];

    gapsList = [
      {
        id: "fallback-gap-1",
        lessonId: "database-normalization",
        nodeType: "core_concept",
        key: "3NF Transitive Dependency elimination",
        summary: "Understanding why removing transitive dependencies achieves 3rd Normal Form and avoids update anomalies.",
        masteryScore: 35,
      },
      {
        id: "fallback-gap-2",
        lessonId: "sql-constraints",
        nodeType: "common_pitfall",
        key: "Foreign Key CASCADE vs RESTRICT action rules",
        summary: "Trouble applying action rules on DELETE/UPDATE referential integrity constraints during database operations.",
        masteryScore: 40,
      },
      {
        id: "fallback-gap-3",
        lessonId: "er-diagrams",
        nodeType: "prerequisite",
        key: "Weak Entity Sets Representation",
        summary: "Identifying weak entity sets and how they receive identifying keys from owner entity relationships.",
        masteryScore: 48,
      },
    ];

    scoreData = [
      { topicTitle: "Database Normalization (1NF, 2NF, 3NF)", avgScore: 55 },
      { topicTitle: "SQL Constraints & Entity Integrity", avgScore: 78 },
      { topicTitle: "Entity-Relationship Diagrams", avgScore: 62 },
    ];
  }

  // ─── AI Study Plan Recommendations ──────────────────────────────────────────
  const weaknessPlan = await getWeaknessAnalysis(scoreData);
  const fallbackWeaknessPlan: WeaknessPlan = {
    summary: "Your overall database schema design skills are solid, but core normalization rules and ER diagram representation remain key weaknesses.",
    weakAreas: [
      {
        topic: "Database Normalization (1NF, 2NF, 3NF)",
        reason: "Average score of 55% indicates confusion with transitive dependency identification.",
        action: "Launch a Lesson Studio workspace session on 3NF normalization rules."
      },
      {
        topic: "Entity-Relationship Diagrams",
        reason: "Scoring 62% on ERDs. Struggling with weak entity primary key mappings.",
        action: "Review prerequisite structures in the relational model canvas."
      }
    ],
    encouragement: "Focus on these key areas! A couple of targeted practice sessions will quickly raise your grade to 80%."
  };

  return (
    <DashboardClient
      syncedCount={syncedCount}
      totalQuestions={totalQuestions}
      attemptedCount={attemptedCount}
      averageScore={averageScore}
      syncsList={syncsList}
      subsList={subsList}
      gapsList={gapsList}
      scoreData={scoreData}
      weaknessPlan={weaknessPlan}
      fallbackWeaknessPlan={fallbackWeaknessPlan}
    />
  );
}
