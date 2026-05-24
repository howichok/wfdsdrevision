"use client";

import Dexie, { type EntityTable } from "dexie";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncLessonAction } from "@/app/actions/lessons";
import { syncOfflineDataAction } from "@/app/actions/sync";
import { useAppSession } from "@/lib/auth/auth-client";
import { appToast } from "@/lib/notifications";
import { useState, useEffect } from "react";

export interface LocalLessonDraft {
  id: string;
  userId: string;
  title: string;
  content: string;
  structuredContent: {
    title: string;
    objectives: string[];
    concepts: string[];
    editorPlaceholder: any; // Tiptap JSON document structure
  };
  status: string;
  synced: 0 | 1; // 0 = unsynced, 1 = synced
  updatedAt: number;
  attachments?: any;
}

export interface LocalChallengeSubmission {
  id: string;
  challengeId: string;
  userId: string;
  userCode: string;
  status: "passed" | "failed";
  synced: 0 | 1;
  updatedAt: number;
}

class LessonsDatabase extends Dexie {
  drafts!: EntityTable<LocalLessonDraft, "id">;
  submissions!: EntityTable<LocalChallengeSubmission, "id">;

  constructor() {
    super("LessonsDatabase");
    this.version(2).stores({
      drafts: "id, userId, synced, updatedAt",
      submissions: "id, userId, challengeId, synced, updatedAt",
    }).upgrade(async tx => {
      // Migrate v1 drafts to v2
      await tx.table("drafts").toCollection().modify(draft => {
        if (draft.synced === undefined) {
          draft.synced = draft.isDirty ? 0 : 1;
        }
        if (draft.userId === undefined) {
          draft.userId = "";
        }
        delete draft.isDirty;
      });
    });
  }
}

let _lessonsDb: LessonsDatabase | null = null;

export function getLessonsDb(): LessonsDatabase {
  if (typeof window === "undefined") {
    throw new Error("Dexie is only available in browser environments");
  }
  if (!_lessonsDb) {
    _lessonsDb = new LessonsDatabase();
  }
  return _lessonsDb;
}

/**
 * Client-side synchronization routine to push unsynced changes to the cloud.
 */
export async function syncLocalChangesToCloud(userId: string) {
  if (typeof window === "undefined" || !userId) return { success: true };
  
  try {
    const db = getLessonsDb();
    
    // Find unsynced drafts for this user
    const unsyncedDrafts = await db.drafts
      .where("userId")
      .equals(userId)
      .filter(d => d.synced === 0)
      .toArray();

    // Find unsynced submissions for this user
    const unsyncedSubmissions = await db.submissions
      .where("userId")
      .equals(userId)
      .filter(s => s.synced === 0)
      .toArray();

    if (unsyncedDrafts.length === 0 && unsyncedSubmissions.length === 0) {
      return { success: true };
    }

    const pendingCount = unsyncedDrafts.length + unsyncedSubmissions.length;
    appToast.sync("syncing", pendingCount);

    console.log(`[Sync] Pushing ${unsyncedDrafts.length} drafts and ${unsyncedSubmissions.length} submissions to cloud...`);

    const result = await syncOfflineDataAction(userId, {
      drafts: unsyncedDrafts.map(d => ({
        id: d.id,
        title: d.title,
        content: d.content,
        structuredContent: d.structuredContent,
        status: d.status,
        updatedAt: d.updatedAt,
      })),
      submissions: unsyncedSubmissions.map(s => ({
        id: s.id,
        challengeId: s.challengeId,
        userCode: s.userCode,
        status: s.status,
        updatedAt: s.updatedAt,
      })),
    });

    if (result.success) {
      // Mark as synced locally
      const draftIds = unsyncedDrafts.map(d => d.id);
      const subIds = unsyncedSubmissions.map(s => s.id);

      if (draftIds.length > 0) {
        await db.drafts.where("id").anyOf(draftIds).modify({ synced: 1 });
      }
      if (subIds.length > 0) {
        await db.submissions.where("id").anyOf(subIds).modify({ synced: 1 });
      }

      console.log(`[Sync] Successfully synced ${draftIds.length} drafts and ${subIds.length} submissions.`);
      appToast.sync("completed");
      return { success: true };
    } else {
      console.warn("[Sync] Server synchronization rejected:", result.error);
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[Sync] Sync local changes to cloud failed:", err);
    appToast.sync("error");
    return { success: false, error: err.message || "Offline sync failed." };
  }
}

/**
 * Offline-first helper to save a challenge submission.
 */
export async function saveChallengeSubmissionLocal(
  userId: string,
  challengeId: string,
  userCode: string,
  status: "passed" | "failed"
) {
  if (typeof window === "undefined") return { success: false };
  
  try {
    const db = getLessonsDb();
    
    // Find if we have an existing local submission for this challenge/user
    const existing = await db.submissions
      .where("userId")
      .equals(userId)
      .filter(s => s.challengeId === challengeId)
      .first();

    const submissionId = existing?.id || crypto.randomUUID();
    const submission: LocalChallengeSubmission = {
      id: submissionId,
      challengeId,
      userId,
      userCode,
      status,
      synced: 0,
      updatedAt: Date.now(),
    };

    // Save locally immediately
    await db.submissions.put(submission);

    return { success: true, id: submissionId };
  } catch (err) {
    console.error("[Dexie] Failed to save challenge submission locally:", err);
    return { success: false };
  }
}

/**
 * React hook to retrieve the current active lesson draft from Dexie.
 * Seeds the local cache from server-supplied initialData if no local version exists.
 */
export function useLessonDraft(lessonId: string, initialLesson: any, userId?: string) {
  const { data: session } = useAppSession();
  const resolvedUserId = userId || session?.user?.id || "";
  const [draft, setDraft] = useState<LocalLessonDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reloadDraft = async () => {
    if (typeof window === "undefined") return;
    try {
      const db = getLessonsDb();
      const local = await db.drafts.get(lessonId);

      const shouldOverwriteProcessing = local?.status === "processing" && 
        (initialLesson?.status === "placeholder" || initialLesson?.status === "published" || initialLesson?.status === "failed");

      if (local && !shouldOverwriteProcessing) {
        setDraft(local);
      } else if (initialLesson) {
      const uid = resolvedUserId || "local";
        const newDraft: LocalLessonDraft = {
          id: lessonId,
          userId: uid,
          title: initialLesson.title || "Untitled Lesson",
          content: initialLesson.content || "",
          structuredContent: initialLesson.structuredContent || {
            title: initialLesson.title || "Untitled Lesson",
            objectives: [],
            concepts: [],
            editorPlaceholder: { type: "doc", content: [] },
          },
          status: initialLesson.status || "placeholder",
          synced: 1, // Freshly fetched from DB is marked synced
          updatedAt: initialLesson.updatedAt ? new Date(initialLesson.updatedAt).getTime() : Date.now(),
          attachments: initialLesson.attachments || null,
        };
        await db.drafts.put(newDraft);
        setDraft(newDraft);
      } else {
        const emptyDraft: LocalLessonDraft = {
          id: lessonId,
          userId: resolvedUserId || "local",
          title: "New Lesson Draft",
          content: "",
          structuredContent: {
            title: "New Lesson Draft",
            objectives: [],
            concepts: [],
            editorPlaceholder: { type: "doc", content: [] },
          },
          status: "placeholder",
          synced: 0,
          updatedAt: Date.now(),
        };
        await db.drafts.put(emptyDraft);
        setDraft(emptyDraft);
      }
    } catch (err) {
      console.error("Failed to load local lesson draft:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadDraft();
  }, [lessonId, initialLesson, resolvedUserId]);

  return { draft, isLoading, reloadDraft };
}

/**
 * TanStack Query Mutation hook to update the lesson content.
 * Writes changes immediately to Dexie (local-first) and triggers a background sync to PostgreSQL.
 */
export function useUpdateLessonMutation(lessonId: string, onSyncSuccess?: () => void) {
  const queryClient = useQueryClient();
  const { data: session } = useAppSession();
  const resolvedUserId = session?.user?.id;

  return useMutation({
    mutationKey: ["update-lesson", lessonId],
    mutationFn: async (updates: Partial<Omit<LocalLessonDraft, "id" | "synced" | "updatedAt">>) => {
      if (typeof window === "undefined") throw new Error("Browser only");
      const db = getLessonsDb();

      const current = await db.drafts.get(lessonId);
      if (!current) throw new Error("Lesson draft not found locally");

      const mergedDraft: LocalLessonDraft = {
        ...current,
        ...updates,
        userId: resolvedUserId || current.userId,
        synced: 0,
        updatedAt: Date.now(),
      };

      await db.drafts.put(mergedDraft);

      const result = await syncLessonAction(lessonId, {
        title: mergedDraft.title,
        content: mergedDraft.content,
        structuredContent: mergedDraft.structuredContent,
        status: mergedDraft.status,
      });

      if (!result.success) {
        throw new Error(result.error || "Postgres offline");
      }

      await db.drafts.update(lessonId, { synced: 1 });
      return { ...mergedDraft, synced: 1 as const };
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["lesson", lessonId] });
      const previousLesson = queryClient.getQueryData(["lesson", lessonId]);

      queryClient.setQueryData(["lesson", lessonId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ...updates,
        };
      });

      return { previousLesson };
    },
    onError: (err, variables, context) => {
      if (context?.previousLesson) {
        queryClient.setQueryData(["lesson", lessonId], context.previousLesson);
      }
      appToast.sync("offline");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lesson", lessonId], data);
      appToast.sync("completed");
      if (onSyncSuccess) onSyncSuccess();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
    },
  });
}
