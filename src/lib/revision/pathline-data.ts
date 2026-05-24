import { db } from "@/lib/db";
import {
  lessons,
  lessonRecallNodes,
  lessonChallenges,
  lessonChallengeSubmissions,
  userErrorMemory,
  topics,
  questions,
  submissions,
} from "@/lib/db/schema";
import { eq, and, desc, inArray, gt } from "drizzle-orm";
import { lessonVisibilityFilter, type UserRole } from "@/lib/auth/permissions";
import {
  filterLessonsByScope,
  filterTopicsByScope,
  findLinkedLesson,
  type RevisionScope,
  DEFAULT_REVISION_SCOPE,
} from "@/lib/revision/revision-scope";

export type PathNodeStatus = "completed" | "active" | "locked";

export interface PathlineNode {
  id: string;
  title: string;
  subtitle: string;
  progress: number;
  status: PathNodeStatus;
  href: string;
  kind: "subject" | "lesson" | "topic" | "concept";
  iconKey: string;
  lessonId?: string;
  topicId?: string;
  concepts?: string[];
}

export interface PathlineData {
  brandTitle: string;
  subject: string;
  specificationSource: string;
  goalsCompleted: number;
  goalsTotal: number;
  streakDays: number;
  nodes: PathlineNode[];
}

function iconKeyForTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("subject") || t.includes("syllabus")) return "book";
  if (t.includes("sql") || t.includes("database") || t.includes("normal")) return "database";
  if (t.includes("network") || t.includes("ecology") || t.includes("web")) return "globe";
  if (t.includes("photo") || t.includes("plant")) return "leaf";
  if (t.includes("cell") || t.includes("mito") || t.includes("bio")) return "atom";
  if (t.includes("code") || t.includes("python") || t.includes("java")) return "code";
  if (t.includes("exam") || t.includes("test")) return "graduation";
  return "layers";
}

function extractConcepts(structuredContent: unknown): string[] {
  if (!structuredContent || typeof structuredContent !== "object") return [];
  const sc = structuredContent as { concepts?: string[]; objectives?: string[] };
  return sc.concepts?.length ? sc.concepts : sc.objectives?.slice(0, 4) ?? [];
}

function parseSpecificationLabel(rawContext: string | null, subject: string): string {
  if (!rawContext) return `${subject} specification`;
  const channelMatch = rawContext.match(/^channel:\s*(.+)$/m);
  if (channelMatch) return channelMatch[1].trim();
  return `${subject} curriculum`;
}

async function lessonProgress(lessonId: string, userId: string): Promise<number> {
  const recallNodes = await db.query.lessonRecallNodes.findMany({
    where: eq(lessonRecallNodes.lessonId, lessonId),
  });

  let recallScore = 0;
  if (recallNodes.length > 0) {
    const keys = recallNodes.map((n) => n.key);
    const memories = await db.query.userErrorMemory.findMany();
    const relevant = memories.filter((m) => keys.includes(m.concept));
    if (relevant.length > 0) {
      recallScore = Math.round(
        relevant.reduce((acc, m) => acc + m.masteryScore, 0) / relevant.length
      );
    }
  }

  const challenges = await db.query.lessonChallenges.findMany({
    where: eq(lessonChallenges.lessonId, lessonId),
  });

  let challengeScore = 0;
  if (challenges.length > 0) {
    const passed = await db.query.lessonChallengeSubmissions.findMany({
      where: and(
        eq(lessonChallengeSubmissions.userId, userId),
        eq(lessonChallengeSubmissions.status, "passed"),
        inArray(
          lessonChallengeSubmissions.challengeId,
          challenges.map((c) => c.id)
        )
      ),
    });
    challengeScore = Math.round((passed.length / challenges.length) * 100);
  }

  if (recallNodes.length === 0 && challenges.length === 0) return 0;
  if (recallNodes.length > 0 && challenges.length > 0) {
    return Math.round((recallScore + challengeScore) / 2);
  }
  return recallScore || challengeScore;
}

async function topicProgress(topicId: string, userId: string): Promise<number> {
  const topicQuestions = await db.query.questions.findMany({
    where: eq(questions.topicId, topicId),
  });
  if (topicQuestions.length === 0) return 0;

  const qIds = topicQuestions.map((q) => q.id);
  const userSubs = await db.query.submissions.findMany({
    where: and(eq(submissions.userId, userId), inArray(submissions.questionId, qIds)),
  });

  const graded = userSubs.filter((s) => s.status === "marked" && s.score !== null);
  if (graded.length === 0) return 0;

  const avg = graded.reduce((acc, s) => acc + (s.score ?? 0), 0) / graded.length;
  return Math.round(avg);
}

function assignStatuses(nodes: Omit<PathlineNode, "status">[]): PathlineNode[] {
  let foundActive = false;
  return nodes.map((node, index) => {
    if (index === 0) {
      const status: PathNodeStatus = node.progress >= 100 ? "completed" : "active";
      if (status === "active") foundActive = true;
      return { ...node, status };
    }

    const prev = nodes[index - 1];
    if (node.progress >= 100) {
      return { ...node, status: "completed" };
    }
    if (prev.progress >= 100 && !foundActive) {
      foundActive = true;
      return { ...node, status: "active" };
    }
    if (node.progress > 0 && !foundActive) {
      foundActive = true;
      return { ...node, status: "active" };
    }
    if (prev.progress < 100 && node.progress === 0) {
      return { ...node, status: "locked" };
    }
    if (node.progress > 0) {
      return { ...node, status: "active" };
    }
    return { ...node, status: prev.progress >= 100 ? "active" : "locked" };
  });
}

export async function buildPathlineData(
  userId: string,
  role: UserRole,
  scope: RevisionScope = DEFAULT_REVISION_SCOPE
): Promise<PathlineData> {
  const visibility = lessonVisibilityFilter(role);

  const allLessonRows =
    visibility === "published_only"
      ? await db.query.lessons.findMany({
          where: eq(lessons.status, "published"),
          orderBy: [desc(lessons.date), desc(lessons.createdAt)],
        })
      : await db.query.lessons.findMany({
          orderBy: [desc(lessons.date), desc(lessons.createdAt)],
        });

  const lessonRows = filterLessonsByScope(allLessonRows, scope);

  const allTopicRows = await db.query.topics.findMany({
    orderBy: [desc(topics.createdAt)],
  });

  const topicRows = filterTopicsByScope(allTopicRows, allLessonRows, scope);

  const primarySubject =
    lessonRows[0]?.subject ?? topicRows[0]?.title?.split(" ")[0] ?? "Computer Science";

  const specSource = parseSpecificationLabel(
    lessonRows[0]?.rawContext ?? null,
    primarySubject
  );

  const rawNodes: Omit<PathlineNode, "status">[] = [];

  rawNodes.push({
    id: "subject-root",
    title: "Subjects",
    subtitle: primarySubject,
    progress: 0,
    href: "/lessons",
    kind: "subject",
    iconKey: "book",
    concepts: [],
  });

  for (const lesson of lessonRows) {
    const progress = await lessonProgress(lesson.id, userId);
    const concepts = extractConcepts(lesson.structuredContent);
    rawNodes.push({
      id: `lesson-${lesson.id}`,
      title: lesson.title.length > 28 ? `${lesson.title.slice(0, 26)}…` : lesson.title,
      subtitle: lesson.subject,
      progress,
      href: `/lessons/${lesson.id}`,
      kind: "lesson",
      iconKey: iconKeyForTitle(lesson.title + " " + concepts.join(" ")),
      lessonId: lesson.id,
      concepts,
    });
  }

  for (const topic of topicRows.slice(0, 6)) {
    const linkedLesson = findLinkedLesson(topic, allLessonRows);
    if (linkedLesson && lessonRows.some((lesson) => lesson.id === linkedLesson.id)) continue;

    const progress = await topicProgress(topic.id, userId);
    rawNodes.push({
      id: `topic-${topic.id}`,
      title: topic.title.length > 28 ? `${topic.title.slice(0, 26)}…` : topic.title,
      subtitle: "Revision topic",
      progress,
      href: `/revision/${topic.id}`,
      kind: "topic",
      iconKey: iconKeyForTitle(topic.title),
      topicId: topic.id,
      concepts: topic.description ? [topic.description] : [],
    });
  }

  if (rawNodes.length > 1) {
    const lessonNodes = rawNodes.slice(1);
    const avg = Math.round(
      lessonNodes.reduce((acc, n) => acc + n.progress, 0) / lessonNodes.length
    );
    rawNodes[0] = { ...rawNodes[0], progress: avg };
  }

  const nodes = assignStatuses(rawNodes.slice(0, 8));

  const goalsTotal = nodes.filter((n) => n.kind !== "subject").length;
  const goalsCompleted = nodes.filter((n) => n.kind !== "subject" && n.progress >= 100).length;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSubs = await db.query.submissions.findMany({
    where: and(eq(submissions.userId, userId), gt(submissions.createdAt, weekAgo)),
  });
  const streakDays = recentSubs.length > 0 ? 1 : 0;

  return {
    brandTitle: "Revision Path",
    subject: primarySubject,
    specificationSource: specSource,
    goalsCompleted,
    goalsTotal,
    streakDays,
    nodes,
  };
}

/** Static syllabus path for offline / no-database mode. */
export function buildOfflinePathlineData(): PathlineData {
  return {
    brandTitle: "Revision Path",
    subject: "Biology",
    specificationSource: "GCSE Biology specification",
    goalsCompleted: 2,
    goalsTotal: 4,
    streakDays: 1,
    nodes: [
      {
        id: "subject-root",
        title: "Subjects",
        subtitle: "Biology",
        progress: 100,
        status: "completed",
        href: "/lessons",
        kind: "subject",
        iconKey: "book",
        concepts: [],
      },
      {
        id: "offline-ch-1",
        title: "Biology",
        subtitle: "Cell biology",
        progress: 100,
        status: "completed",
        href: "/revision",
        kind: "lesson",
        iconKey: "atom",
        concepts: ["Cells", "Organisation"],
      },
      {
        id: "offline-ch-2",
        title: "Mitochondria",
        subtitle: "Cell biology",
        progress: 76,
        status: "active",
        href: "/revision",
        kind: "lesson",
        iconKey: "atom",
        concepts: ["ATP production", "Cell respiration", "Membrane structure"],
      },
      {
        id: "offline-ch-3",
        title: "Photosynthesis",
        subtitle: "Plant biology",
        progress: 0,
        status: "locked",
        href: "/revision",
        kind: "topic",
        iconKey: "leaf",
        concepts: ["Light-dependent reactions", "Calvin cycle"],
      },
      {
        id: "offline-ch-4",
        title: "Ecology",
        subtitle: "Ecosystems",
        progress: 0,
        status: "locked",
        href: "/revision",
        kind: "topic",
        iconKey: "globe",
        concepts: ["Food webs", "Nutrient cycles"],
      },
    ],
  };
}
