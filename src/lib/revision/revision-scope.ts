export type RevisionScopeMode = "all" | "lesson" | "date" | "range"

export interface RevisionScope {
  mode: RevisionScopeMode
  lessonId?: string
  date?: string
  dateFrom?: string
  dateTo?: string
}

export interface RevisionLessonOption {
  id: string
  title: string
  date: string | null
  subject: string
}

export const DEFAULT_REVISION_SCOPE: RevisionScope = { mode: "all" }

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

function isInRange(date: Date, from: Date, to: Date): boolean {
  const value = startOfDay(date).getTime()
  return value >= startOfDay(from).getTime() && value <= startOfDay(to).getTime()
}

export function parseRevisionScope(searchParams: URLSearchParams): RevisionScope {
  const lessonId = searchParams.get("lessonId")?.trim()
  const date = searchParams.get("date")?.trim()
  const dateFrom = searchParams.get("dateFrom")?.trim()
  const dateTo = searchParams.get("dateTo")?.trim()

  if (lessonId) return { mode: "lesson", lessonId }
  if (dateFrom && dateTo) return { mode: "range", dateFrom, dateTo }
  if (date) return { mode: "date", date }
  return DEFAULT_REVISION_SCOPE
}

export function revisionScopeToSearchParams(scope: RevisionScope): URLSearchParams {
  const params = new URLSearchParams()

  if (scope.mode === "lesson" && scope.lessonId) {
    params.set("lessonId", scope.lessonId)
  } else if (scope.mode === "date" && scope.date) {
    params.set("date", scope.date)
  } else if (scope.mode === "range") {
    if (scope.dateFrom) params.set("dateFrom", scope.dateFrom)
    if (scope.dateTo) params.set("dateTo", scope.dateTo)
  }

  return params
}

export function revisionScopeQueryString(scope: RevisionScope): string {
  const params = revisionScopeToSearchParams(scope)
  const value = params.toString()
  return value ? `?${value}` : ""
}

export function findLinkedLesson<
  TTopic extends { title: string },
  TLesson extends { id: string; title: string },
>(topic: TTopic, lessons: TLesson[]): TLesson | undefined {
  const topicKey = topic.title.toLowerCase().slice(0, 12)
  return lessons.find(
    (lesson) =>
      lesson.title.toLowerCase().includes(topicKey) ||
      topic.title.toLowerCase().includes(lesson.title.toLowerCase().slice(0, 12))
  )
}

export function filterLessonsByScope<
  T extends { id: string; date: Date | string | null },
>(rows: T[], scope: RevisionScope): T[] {
  if (scope.mode === "all") return rows

  if (scope.mode === "lesson" && scope.lessonId) {
    return rows.filter((row) => row.id === scope.lessonId)
  }

  if (scope.mode === "date" && scope.date) {
    const target = parseDateOnly(scope.date)
    return rows.filter((row) => row.date && isSameDay(new Date(row.date), target))
  }

  if (scope.mode === "range" && scope.dateFrom && scope.dateTo) {
    const from = parseDateOnly(scope.dateFrom)
    const to = parseDateOnly(scope.dateTo)
    return rows.filter((row) => row.date && isInRange(new Date(row.date), from, to))
  }

  return rows
}

export function filterTopicsByScope<
  TTopic extends { title: string; createdAt: Date | string },
  TLesson extends { id: string; title: string; date: Date | string | null },
>(topics: TTopic[], lessons: TLesson[], scope: RevisionScope): TTopic[] {
  if (scope.mode === "all") return topics

  const scopedLessons = filterLessonsByScope(lessons, scope)
  const scopedLessonIds = new Set(scopedLessons.map((lesson) => lesson.id))

  return topics.filter((topic) => {
    const linkedLesson = findLinkedLesson(topic, lessons)

    if (linkedLesson) {
      if (scope.mode === "lesson") return linkedLesson.id === scope.lessonId
      return scopedLessonIds.has(linkedLesson.id)
    }

    if (scope.mode === "lesson") return false

    const createdAt = new Date(topic.createdAt)

    if (scope.mode === "date" && scope.date) {
      return isSameDay(createdAt, parseDateOnly(scope.date))
    }

    if (scope.mode === "range" && scope.dateFrom && scope.dateTo) {
      return isInRange(
        createdAt,
        parseDateOnly(scope.dateFrom),
        parseDateOnly(scope.dateTo)
      )
    }

    return false
  })
}

export function formatRevisionLessonDate(value: Date | string | null): string {
  if (!value) return "No date"
  const date = new Date(value)
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function describeRevisionScope(
  scope: RevisionScope,
  lessons: RevisionLessonOption[]
): string {
  if (scope.mode === "lesson" && scope.lessonId) {
    const lesson = lessons.find((row) => row.id === scope.lessonId)
    return lesson ? `Lesson: ${lesson.title}` : "Selected lesson"
  }

  if (scope.mode === "date" && scope.date) {
    return `Date: ${formatRevisionLessonDate(scope.date)}`
  }

  if (scope.mode === "range" && scope.dateFrom && scope.dateTo) {
    return `${formatRevisionLessonDate(scope.dateFrom)} – ${formatRevisionLessonDate(scope.dateTo)}`
  }

  return "All lessons and topics"
}
