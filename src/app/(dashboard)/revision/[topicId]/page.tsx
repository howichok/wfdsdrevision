import { db } from "@/lib/db";
import { topics, questions, submissions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TopicWorkspaceClient } from "./workspace-client";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    topicId: string;
  }>;
};

export default async function TopicWorkspacePage({ params }: RouteParams) {
  const { topicId } = await params;

  // 1. Fetch topic details
  const topic = await db.query.topics.findFirst({
    where: eq(topics.id, topicId),
  });

  if (!topic) {
    notFound();
  }

  // 2. Fetch questions for the topic
  const topicQuestions = await db.query.questions.findMany({
    where: eq(questions.topicId, topicId),
  });

  // 3. Resolve user
  let userId = "";
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    const firstUser = await db.query.users.findFirst();
    if (firstUser) userId = firstUser.id;
  }

  // 4. Fetch previous attempts/submissions by user for these questions
  const prevSubmissions = await db.query.submissions.findMany({
    where: eq(submissions.userId, userId),
    orderBy: [desc(submissions.createdAt)],
  });

  return (
    <TopicWorkspaceClient
      topic={topic}
      questions={topicQuestions}
      initialSubmissions={prevSubmissions}
    />
  );
}
