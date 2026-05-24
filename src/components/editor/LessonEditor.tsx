"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CodeSandboxNode } from "./CodeSandboxNode";
import { useUpdateLessonMutation, type LocalLessonDraft } from "@/lib/db/dexie-store";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Code,
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface LessonEditorProps {
  draft: LocalLessonDraft;
  reloadDraft: () => Promise<void>;
}

export function LessonEditor({ draft, reloadDraft }: LessonEditorProps) {
  const { mutate, isPending } = useUpdateLessonMutation(draft.id, () => {
    // Reload local draft state on successful sync to resolve synced state
    reloadDraft();
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default standard code block
      }),
      CodeSandboxNode, // Register custom interactive code sandbox block
    ],
    content: draft.structuredContent.editorPlaceholder || { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none focus:outline-none min-h-[400px] text-slate-200 px-4 py-3 leading-relaxed",
      },
    },
  });

  // Debounced Auto-save to Dexie & Postgres
  useEffect(() => {
    if (!editor) return;

    let timeoutId: NodeJS.Timeout;

    const handleUpdate = () => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        const json = editor.getJSON();
        const plainText = editor.getText();

        mutate({
          content: plainText,
          structuredContent: {
            title: draft.title || "Untitled Lesson",
            objectives: draft.structuredContent.objectives || [],
            concepts: draft.structuredContent.concepts || [],
            editorPlaceholder: json,
          },
        });
      }, 1200); // 1.2s debounce to aggregate typing cycles
    };

    editor.on("update", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [editor, mutate, draft]);

  if (!editor) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />
        <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  // Render proper Sync indicator depending on Dexie and Server mutation states
  const renderSyncStatus = () => {
    if (isPending) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-950/40 border border-purple-500/20 px-2.5 py-1 rounded-full animate-pulse select-none">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Saving...
        </span>
      );
    }
    if (draft.synced === 0) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 border border-amber-500/20 px-2.5 py-1 rounded-full select-none">
          <CloudOff className="h-3 w-3" />
          Offline Draft (Unsynced)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1 rounded-full select-none">
        <Cloud className="h-3 w-3" />
        Synced to Cloud
      </span>
    );
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/30 shadow-2xl backdrop-blur-lg overflow-hidden">
      {/* Rich Text Toolbar Panel */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-slate-950/60 p-2 gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Format Actions */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded-xl transition-all hover-lift active-press cursor-pointer ${
              editor.isActive("bold")
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded-xl transition-all hover-lift active-press cursor-pointer ${
              editor.isActive("italic")
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>

          <span className="w-[1px] h-5 bg-white/10 mx-1" />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded-xl transition-all hover-lift active-press cursor-pointer ${
              editor.isActive("bulletList")
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded-xl transition-all hover-lift active-press cursor-pointer ${
              editor.isActive("orderedList")
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-2 rounded-xl transition-all hover-lift active-press cursor-pointer ${
              editor.isActive("blockquote")
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
            title="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </button>

          <span className="w-[1px] h-5 bg-white/10 mx-1" />

          {/* Interactive Code Sandbox Node Insertion */}
          <button
            onClick={() => editor.chain().focus().setCodeBlock().run()}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all hover-lift active-press cursor-pointer ${
              editor.isActive("codeBlock")
                ? "bg-purple-600 border-purple-500 text-white"
                : "border-white/10 text-purple-400 bg-purple-950/20 hover:bg-purple-900/20 hover:text-purple-300"
            }`}
            title="Insert Code Sandbox"
          >
            <Code className="h-4 w-4" />
            <span className="text-xs font-semibold">Sandbox</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {renderSyncStatus()}

          <span className="w-[1px] h-5 bg-white/10" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              className="p-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover-lift active-press cursor-pointer"
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              className="p-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover-lift active-press cursor-pointer"
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="bg-slate-950/30 overflow-y-auto max-h-[600px] border-b border-white/5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
