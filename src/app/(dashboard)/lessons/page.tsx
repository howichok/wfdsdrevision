import { db } from "@/lib/db";
import { teamsMessages, lessons } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Plus, BookOpen, Settings } from "lucide-react";
import Link from "next/link";
import { LessonsClient } from "./lessons-client";
import {
  getSessionUser,
  canCreateLessons,
  canViewTeamsSync,
  lessonVisibilityFilter,
} from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const user = await getSessionUser();
  const visibility = user ? lessonVisibilityFilter(user.role) : "published_only";

  let allMessages: Awaited<ReturnType<typeof db.query.teamsMessages.findMany>> = [];
  let allLessons: Awaited<ReturnType<typeof db.query.lessons.findMany>> = [];

  try {
    allMessages = await db.query.teamsMessages.findMany({
      orderBy: [desc(teamsMessages.createdAt)],
    });
  } catch (err) {
    console.warn("Failed to fetch teamsMessages from DB:", err);
  }

  try {
    if (visibility === "published_only") {
      allLessons = await db.query.lessons.findMany({
        where: eq(lessons.status, "published"),
        orderBy: [desc(lessons.createdAt)],
      });
    } else {
      allLessons = await db.query.lessons.findMany({
        orderBy: [desc(lessons.createdAt)],
      });
    }
  } catch (err) {
    console.warn("Failed to fetch lessons from DB:", err);
  }

  const mappedMessages = allMessages.map((msg) => ({
    id: msg.id,
    sender: msg.sender,
    content: msg.content,
    attachments: msg.attachments,
    createdAt: msg.postedAt ?? msg.createdAt,
    isCustomLesson: false,
  }));

  const mappedLessons = allLessons.map((les) => ({
    id: les.id,
    sender: les.teacherName,
    title: les.title,
    content: les.content,
    attachments: les.attachments,
    createdAt: les.createdAt,
    status: les.status,
    isCustomLesson: true,
  }));

  const combined = [...mappedMessages, ...mappedLessons].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const showCreate = user && canCreateLessons(user.role);
  const showTeams = user && canViewTeamsSync(user.role);

  return (
    <div className="flex flex-col min-h-[calc(100vh-10rem)] w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-5">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Lessons Hub
          </h1>
          <p className="text-xs text-muted-foreground">
            Explore synchronized class material, teacher slides, and access interactive learning sandboxes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showCreate && (
            <Link
              href="/lessons/create"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5b5fc7] px-4 text-xs font-semibold text-white hover:bg-[#4f46e5] transition-all shadow-md cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create Lesson
            </Link>
          )}
          {showTeams && (
            <Link
              href="/teams"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/40 bg-card/65 px-4 text-xs font-semibold hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
            >
              <Settings className="h-4 w-4" />
              {user?.role === "SA" ? "Teams Sync" : "Teams Activity"}
            </Link>
          )}
        </div>
      </div>

      <LessonsClient initialMessages={combined} />
    </div>
  );
}
