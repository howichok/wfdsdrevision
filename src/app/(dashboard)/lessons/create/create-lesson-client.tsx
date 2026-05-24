"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  User,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Paperclip,
  Tag,
} from "lucide-react";
import Link from "next/link";

interface AttachmentForm {
  fileName: string;
  type: string;
  url: string;
}

export default function CreateLessonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Computer Science");
  const [teacherName, setTeacherName] = useState("Dr. Elizabeth Vance");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<AttachmentForm[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState("");

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim()) return;
    const fileName = newAttachmentName.trim();
    const type = fileName.split(".").pop() || "pdf";
    setAttachments((prev) => [...prev, { fileName, type: type.toLowerCase(), url: "#" }]);
    setNewAttachmentName("");
    toast.success(`Attachment "${fileName}" added`);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please provide both a lesson title and textbook content.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          subject: subject.trim(),
          teacherName: teacherName.trim(),
          attachments: attachments.length > 0 ? attachments : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create lesson");

      if (data.success && data.lesson?.id) {
        toast.success("AI is generating your lesson. This may take a minute...");
        router.push(`/lessons/${data.lesson.id}`);
        return;
      }

      throw new Error("Unexpected response from server");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create lesson";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link
          href="/lessons"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Create New Lesson
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Paste raw material — AI will structure objectives, editor content, recall nodes, and challenges.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Lesson Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database Normalization (3NF)"
              className="w-full rounded-xl border border-border/40 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Teacher Name
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold">Raw Textbook / Class Material</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste lecture notes, Teams post text, or syllabus content..."
              rows={12}
              className="w-full rounded-xl border border-border/40 bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              Attachments (optional filenames)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAttachmentName}
                onChange={(e) => setNewAttachmentName(e.target.value)}
                placeholder="filename.pdf"
                className="flex-1 rounded-xl border border-border/40 bg-background px-4 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold hover:bg-accent/80"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2 text-xs"
                  >
                    <span>{att.fileName}</span>
                    <button type="button" onClick={() => handleRemoveAttachment(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting AI generation...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Lesson with AI
            </>
          )}
        </button>
      </form>
    </div>
  );
}
