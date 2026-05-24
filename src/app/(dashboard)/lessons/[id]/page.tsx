import { db } from "@/lib/db";
import { lessons, lessonChallenges, teamsMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";
import { LessonStudioClient } from "./lesson-studio-client";
import { redirect } from "next/navigation";
import { getSessionUser, canPublishLessons, lessonVisibilityFilter } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{ id: string }>;
}

const SEED_LESSONS: Record<string, any> = {
  "msg-seed-1": {
    id: "msg-seed-1",
    title: "Database Normalization (1NF, 2NF, 3NF)",
    content: "Database Normalization is the process of structuring a relational database in accordance with a series of so-called normal forms in order to reduce data redundancy and improve data integrity. First Normal Form (1NF) requires that data be atomic and have no repeating groups. Second Normal Form (2NF) requires that it is in 1NF and all non-prime attributes are fully functionally dependent on the entire primary key (no partial dependencies). Third Normal Form (3NF) requires that it is in 2NF and there are no transitive dependencies (where a non-prime attribute determines another non-prime attribute). Resolving these dependencies involves splitting fields into dedicated tables.",
    subject: "Computer Science",
    teacherName: "Dr. Elizabeth Vance",
    status: "published",
    attachments: [
      {
        fileName: "Database_Normalization_Syllabus.pdf",
        url: "#",
        type: "pdf",
      },
    ],
    structuredContent: {
      title: "Database Normalization (1NF, 2NF, 3NF)",
      objectives: [
        "Understand data redundancy and update anomalies.",
        "Normalize relational designs to 1NF (atomic attributes).",
        "Resolve partial functional dependencies to meet 2NF.",
        "Resolve transitive functional dependencies to meet 3NF.",
      ],
      concepts: ["1NF", "2NF", "3NF", "Transitive Dependency", "Functional Dependency"],
      editorPlaceholder: { type: "doc", content: [] },
    },
  },
  "msg-seed-2": {
    id: "msg-seed-2",
    title: "SQL Constraints & Keys",
    content: "SQL Constraints are rules enforced on data columns in a table. They prevent invalid data from being entered. Key constraints include PRIMARY KEY, which uniquely identifies records and cannot be NULL, and FOREIGN KEY, which references a PRIMARY KEY in another table to maintain Referential Integrity. Other constraints include UNIQUE (ensuring all values in a column are distinct), NOT NULL, and CHECK (validating values against a boolean expression). Constraints are defined during table creation or altered later.",
    subject: "Computer Science",
    teacherName: "Dr. Elizabeth Vance",
    status: "published",
    attachments: [
      {
        fileName: "SQL_Constraints_and_Keys.docx",
        url: "#",
        type: "docx",
      },
    ],
    structuredContent: {
      title: "SQL Constraints & Keys",
      objectives: [
        "Define and apply Key constraints (Primary & Foreign keys).",
        "Understand Entity Integrity and Referential Integrity.",
        "Enforce data validity using CHECK, UNIQUE, and NOT NULL constraints.",
      ],
      concepts: ["Primary Key", "Foreign Key", "Referential Integrity", "CHECK Constraint", "UNIQUE"],
      editorPlaceholder: { type: "doc", content: [] },
    },
  },
  "msg-seed-3": {
    id: "msg-seed-3",
    title: "Entity-Relationship (ER) Diagrams",
    content: "An Entity-Relationship Diagram (ERD) is a visual representation of different entities within a system and how they relate to each other. Key components include Entities (tables), Attributes (fields), and Relationships (connections). Cardinality describes the numerical relationship between entities, such as One-to-One (1:1), One-to-Many (1:N), and Many-to-Many (M:N). Defining accurate relationships is crucial before physical schema implementation.",
    subject: "Computer Science",
    teacherName: "Dr. Elizabeth Vance",
    status: "published",
    attachments: null,
    structuredContent: {
      title: "Entity-Relationship (ER) Diagrams",
      objectives: [
        "Visualize entity collections and attributes in entity diagrams.",
        "Identify relationship cardinality (1:1, 1:N, M:N).",
        "Translate conceptual ER models into concrete database relations.",
      ],
      concepts: ["Entity", "Attribute", "Cardinality", "ER Diagram", "Relation Schema"],
      editorPlaceholder: { type: "doc", content: [] },
    },
  },
};

export default async function LessonDetailPage({ params }: LessonPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const userId = user.id;
  const canPublish = canPublishLessons(user.role);
  const visibility = lessonVisibilityFilter(user.role);
  const { id } = await params;
  let initialLesson: any = null;
  let challengesList: any[] = [];
  let dbOffline = false;

  // 1. Try resolving mock seed lessons first
  if (SEED_LESSONS[id]) {
    initialLesson = SEED_LESSONS[id];
  } else {
    try {
      // 2. Query lessons table
      const records = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .limit(1);

      if (records.length > 0) {
        initialLesson = records[0];
        if (visibility === "published_only" && initialLesson.status !== "published") {
          redirect("/lessons");
        }
        if (initialLesson.userId && initialLesson.userId !== userId && visibility === "published_only") {
          redirect("/lessons");
        }
      } else {
        // 3. Fallback: Query teamsMessages table
        const msgRecords = await db
          .select()
          .from(teamsMessages)
          .where(eq(teamsMessages.id, id))
          .limit(1);

        if (msgRecords.length > 0) {
          const msg = msgRecords[0];
          initialLesson = {
            id: msg.id,
            title: "Synced Class Announcement",
            content: msg.content,
            subject: "Computer Science",
            teacherName: msg.sender,
            attachments: msg.attachments,
            status: "published",
            createdAt: msg.createdAt,
            updatedAt: msg.createdAt,
            structuredContent: {
              title: "Synced Class Announcement",
              objectives: [
                "Understand the class updates and announcement syllabus context.",
                "Review the attached learning documents and resource guidelines.",
              ],
              concepts: ["Announcement", "Syllabus Context", "Class Update"],
              editorPlaceholder: { type: "doc", content: [] },
            },
          };
        }
      }

      if (initialLesson) {
        challengesList = await db
          .select()
          .from(lessonChallenges)
          .where(eq(lessonChallenges.lessonId, id));
      }
    } catch (err) {
      console.warn(`[Lesson Page] Failed to fetch lesson details or challenges for ${id}:`, err);
      dbOffline = true;
    }
  }

  // Create default fallback if nothing is found (e.g. offline fallback)
  if (!initialLesson) {
    initialLesson = {
      id,
      title: "Interactive Custom Lesson",
      content: "Start typing details or notes here.",
      subject: "Computer Science",
      teacherName: "Dr. Elizabeth Vance",
      status: "published",
      structuredContent: {
        title: "Interactive Custom Lesson",
        objectives: ["Draft notes and complete textbook summaries.", "Start AI-guided study and review sessions."],
        concepts: ["Custom Lesson", "Drafting Notes"],
        editorPlaceholder: { type: "doc", content: [] },
      },
    };
  }

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-10rem)] border border-border/20 rounded-2xl p-6 bg-card/30 backdrop-blur-xl">
      {/* Top Navigation / Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/20 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/lessons"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 hover:bg-accent transition-all text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">
              {initialLesson?.title || "Lesson Studio"}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <BookOpen className="h-3.5 w-3.5 text-purple-400" />
              {initialLesson?.subject || "Computer Science"} • Classroom Studio
            </p>
          </div>
        </div>

        {dbOffline && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-950/20 border border-amber-500/20 px-3.5 py-2 text-xs text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 animate-pulse" />
            <span>Database Connection Offline. Working locally.</span>
          </div>
        )}
      </div>

      {/* Interactive execution client workspace */}
      <LessonStudioClient
        lessonId={id}
        initialLesson={initialLesson}
        challenges={challengesList}
        userId={userId}
        canPublish={canPublish}
      />
    </div>
  );
}


