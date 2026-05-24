import type { RevisionHubData } from "@/lib/revision/hub-data"
import {
  describeRevisionScope,
  formatRevisionLessonDate,
  type RevisionScope,
} from "@/lib/revision/revision-scope"

export function buildRevisionContextBlock(
  scope: RevisionScope,
  data: Pick<RevisionHubData, "lessons" | "topics">
): string {
  const lines = [`Revision scope: ${describeRevisionScope(scope, data.lessons)}`]

  if (scope.mode === "lesson" && scope.lessonId) {
    const lesson = data.lessons.find((row) => row.id === scope.lessonId)
    if (lesson) {
      lines.push(
        `Focused lesson: ${lesson.title} (${formatRevisionLessonDate(lesson.date)}) · ${lesson.subject}`
      )
    }
  }

  if (scope.mode === "date" && scope.date) {
    lines.push(`Revision date: ${formatRevisionLessonDate(scope.date)}`)
  }

  if (scope.mode === "range" && scope.dateFrom && scope.dateTo) {
    lines.push(
      `Revision window: ${formatRevisionLessonDate(scope.dateFrom)} to ${formatRevisionLessonDate(scope.dateTo)}`
    )
  }

  if (data.topics.length > 0) {
    lines.push("", "Topics in scope:")
    for (const topic of data.topics.slice(0, 8)) {
      lines.push(
        `- ${topic.title}${topic.description ? `: ${topic.description}` : ""}${
          topic.linkedLessonTitle ? ` [${topic.linkedLessonTitle}]` : ""
        }`
      )
    }
  } else {
    lines.push("", "No synced revision topics matched this scope yet.")
  }

  return lines.join("\n")
}
