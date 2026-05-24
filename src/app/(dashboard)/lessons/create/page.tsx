import { redirect } from "next/navigation";
import { getSessionUser, canCreateLessons } from "@/lib/auth/permissions";
import CreateLessonPage from "./create-lesson-client";

export default async function CreateLessonRoute() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canCreateLessons(user.role)) redirect("/lessons");

  return <CreateLessonPage />;
}
