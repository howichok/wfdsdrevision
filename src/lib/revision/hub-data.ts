import { db } from "@/lib/db"
import { topics, questions, submissions, lessons } from "@/lib/db/schema"
import { eq, sql, desc } from "drizzle-orm"
import { lessonVisibilityFilter, type UserRole } from "@/lib/auth/permissions"
import {
  filterTopicsByScope,
  type RevisionLessonOption,
  type RevisionScope,
  DEFAULT_REVISION_SCOPE,
} from "@/lib/revision/revision-scope"

export interface RevisionTopicCard {
  id: string
  title: string
  description: string | null
  questionCount: number
  attempts: number
  averageScore: number | null
  createdAt: string
  linkedLessonId: string | null
  linkedLessonTitle: string | null
}

export interface RevisionHubData {
  scope: RevisionScope
  lessons: RevisionLessonOption[]
  topics: RevisionTopicCard[]
}

async function loadVisibleLessons(role: UserRole) {
  const visibility = lessonVisibilityFilter(role)

  return visibility === "published_only"
    ? db.query.lessons.findMany({
        where: eq(lessons.status, "published"),
        orderBy: [desc(lessons.date), desc(lessons.createdAt)],
      })
    : db.query.lessons.findMany({
        orderBy: [desc(lessons.date), desc(lessons.createdAt)],
      })
}

export async function buildRevisionHubData(
  role: UserRole,
  scope: RevisionScope = DEFAULT_REVISION_SCOPE
): Promise<RevisionHubData> {
  const lessonRows = await loadVisibleLessons(role)
  const allTopics = await db.query.topics.findMany({
    orderBy: [desc(topics.createdAt)],
  })

  const scopedTopics = filterTopicsByScope(allTopics, lessonRows, scope)

  const topicCards = await Promise.all(
    scopedTopics.map(async (topic) => {
      const topicQuestions = await db.query.questions.findMany({
        where: eq(questions.topicId, topic.id),
      })

      const questionIds = topicQuestions.map((question) => question.id)

      let attempts = 0
      let averageScore: number | null = null

      if (questionIds.length > 0) {
        const matchingSubmissions = await db.query.submissions.findMany({
          where: sql`${submissions.questionId} IN ${questionIds}`,
        })

        attempts = matchingSubmissions.length
        const gradedSubmissions = matchingSubmissions.filter(
          (submission) => submission.status === "marked" && submission.score !== null
        )

        if (gradedSubmissions.length > 0) {
          const sum = gradedSubmissions.reduce(
            (total, submission) => total + (submission.score || 0),
            0
          )
          averageScore = Math.round(sum / gradedSubmissions.length)
        }
      }

      const linkedLesson = lessonRows.find(
        (lesson) =>
          lesson.title.toLowerCase().includes(topic.title.toLowerCase().slice(0, 12)) ||
          topic.title.toLowerCase().includes(lesson.title.toLowerCase().slice(0, 12))
      )

      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        questionCount: topicQuestions.length,
        attempts,
        averageScore,
        createdAt: topic.createdAt.toISOString(),
        linkedLessonId: linkedLesson?.id ?? null,
        linkedLessonTitle: linkedLesson?.title ?? null,
      }
    })
  )

  return {
    scope,
    lessons: lessonRows.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      date: lesson.date ? new Date(lesson.date).toISOString() : null,
      subject: lesson.subject,
    })),
    topics: topicCards,
  }
}
