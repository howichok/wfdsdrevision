"use client";

/**
 * WorkspaceIDE — Multi-file WebContainer sandbox with AI code-review.
 *
 * Layout:
 *   ┌─ toolbar ──────────────────────────────────────────────────────────┐
 *   │ project name          [Run Tests]  [Submit PR / Unlock]            │
 *   ├─ file tree ──┬─ code editor ──────────────────────────────────────┤
 *   │  src/        │  <textarea> or line-by-line review renderer         │
 *   │    index.ts  │                                                     │
 *   │  package.json│                                                     │
 *   ├──────────────┴─────────────────────────────────────────────────────┤
 *   │ terminal  (streaming npm install / npm test output)                │
 *   └────────────────────────────────────────────────────────────────────┘
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  GitPullRequest,
  Loader2,
  Lock,
  LockOpen,
  Play,
  RefreshCw,
  Terminal,
  Zap,
} from "lucide-react";
import { getWebContainer } from "@/lib/sandboxes/runner";
import {
  filesToTree,
  type ReviewComment,
  type WorkspaceFiles,
} from "@/lib/sandboxes/webcontainer-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContainerStatus = "idle" | "booting" | "ready" | "error";
type RunStatus = "idle" | "installing" | "testing" | "done" | "failed";
type ReviewStatus = "idle" | "pending" | "done" | "error";

export interface WorkspaceIDEProps {
  initialFiles: WorkspaceFiles;
  projectName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Group flat paths into a two-level structure: root files + named directories. */
function groupPaths(paths: string[]): {
  rootFiles: string[];
  dirs: Record<string, string[]>;
} {
  const rootFiles: string[] = [];
  const dirs: Record<string, string[]> = {};

  for (const p of paths) {
    const slashIdx = p.indexOf("/");
    if (slashIdx === -1) {
      rootFiles.push(p);
    } else {
      const dir = p.slice(0, slashIdx);
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push(p);
    }
  }

  return { rootFiles, dirs };
}

/** Returns the short display name for a path (last segment). */
function basename(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] ?? p;
}

/** Colour palette for review comment types. */
const COMMENT_STYLES = {
  error: {
    border: "border-rose-500/40",
    bg: "bg-rose-950/30",
    icon: "text-rose-400",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    label: "Error",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-950/25",
    icon: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    label: "Warning",
  },
  optimization: {
    border: "border-indigo-500/40",
    bg: "bg-indigo-950/25",
    icon: "text-indigo-400",
    badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
    label: "Optimization",
  },
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Expandable AI review callout rendered directly after a line. */
function ReviewCallout({ comment }: { comment: ReviewComment }) {
  const [expanded, setExpanded] = useState(true);
  const s = COMMENT_STYLES[comment.type];

  return (
    <div className={`border-l-2 ${s.border} ${s.bg} mx-2 my-0.5 rounded-r-lg overflow-hidden`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {comment.type === "error" && (
          <AlertCircle className={`h-3 w-3 shrink-0 ${s.icon}`} />
        )}
        {comment.type === "warning" && (
          <AlertTriangle className={`h-3 w-3 shrink-0 ${s.icon}`} />
        )}
        {comment.type === "optimization" && (
          <Zap className={`h-3 w-3 shrink-0 ${s.icon}`} />
        )}
        <span
          className={`text-[9px] font-bold uppercase tracking-widest rounded-full border px-1.5 py-0.5 ${s.badge}`}
        >
          {s.label}
        </span>
        <span className="text-[10px] text-slate-400 flex-1 truncate">
          Line {comment.lineNumber}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-slate-300">
          {comment.comment}
        </p>
      )}
    </div>
  );
}

/** Line-by-line read-only code renderer with inline review callouts. */
function ReviewCodeView({
  contents,
  comments,
}: {
  contents: string;
  comments: ReviewComment[];
}) {
  const lines = contents.split("\n");

  // Map line number → comments for that line
  const byLine = useMemo(() => {
    const m = new Map<number, ReviewComment[]>();
    for (const c of comments) {
      const existing = m.get(c.lineNumber) ?? [];
      m.set(c.lineNumber, [...existing, c]);
    }
    return m;
  }, [comments]);

  return (
    <div className="overflow-auto h-full font-mono text-[11px] leading-5 select-text">
      {lines.map((line, idx) => {
        const lineNum = idx + 1;
        const lineComments = byLine.get(lineNum);
        const hasComment = Boolean(lineComments?.length);

        return (
          <div key={idx}>
            {/* Code line */}
            <div
              className={`flex gap-0 group ${
                hasComment ? "bg-amber-950/10" : "hover:bg-white/[0.02]"
              }`}
            >
              <span
                className="w-10 shrink-0 text-right pr-3 text-slate-600 select-none border-r border-white/5"
              >
                {lineNum}
              </span>
              <span className="flex-1 pl-3 text-slate-200 whitespace-pre">
                {line}
              </span>
            </div>

            {/* Inline callouts for this line */}
            {lineComments?.map((c, ci) => (
              <ReviewCallout key={ci} comment={c} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Textarea-based code editor with Tab-key indent support and line numbers. */
function CodeEditor({
  filePath,
  contents,
  onChange,
  disabled,
}: {
  filePath: string;
  contents: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const lines = contents.split("\n");
  const lineCount = lines.length;
  const lineNumRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep line-number gutter scroll in sync with textarea scroll
  const handleScroll = () => {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = contents.substring(0, start) + "  " + contents.substring(end);
    onChange(next);
    // Restore cursor after React re-renders
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  };

  return (
    <div className="flex h-full overflow-hidden font-mono text-[11px] leading-5">
      {/* Line number gutter */}
      <div
        ref={lineNumRef}
        aria-hidden
        className="w-10 shrink-0 overflow-hidden select-none text-right text-slate-600 border-r border-white/5 bg-slate-950/40 pt-3 pr-2"
        style={{ overflowY: "hidden" }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      {/* Editable text area */}
      <textarea
        ref={textareaRef}
        value={contents}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        disabled={disabled}
        spellCheck={false}
        aria-label={`Editor: ${filePath}`}
        className="flex-1 resize-none bg-transparent pl-3 pt-3 text-slate-200 outline-none leading-5 font-mono caret-indigo-400 disabled:opacity-50"
        style={{ tabSize: 2 }}
        placeholder="// Start writing code…"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkspaceIDE({
  initialFiles,
  projectName = "workspace",
}: WorkspaceIDEProps) {
  // ── State ──
  const [files, setFiles] = useState<WorkspaceFiles>(() => ({ ...initialFiles }));
  const [activeFile, setActiveFile] = useState<string>(
    () => Object.keys(initialFiles)[0] ?? ""
  );
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>("idle");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("idle");
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    // Open all directories by default
    const dirs = new Set<string>();
    for (const p of Object.keys(initialFiles)) {
      const slashIdx = p.indexOf("/");
      if (slashIdx !== -1) dirs.add(p.slice(0, slashIdx));
    }
    return dirs;
  });

  // ── Refs ──
  const wcRef = useRef<Awaited<ReturnType<typeof getWebContainer>> | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll terminal ──
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // ── Append a line to the terminal ──
  const appendLog = useCallback((chunk: string) => {
    // WebContainer output can arrive as multi-line chunks; split them for clean rendering
    const lines = chunk.split(/\r?\n/);
    setTerminalLines((prev) => [...prev, ...lines]);
  }, []);

  // ── Boot WebContainer and mount project files ──
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setContainerStatus("booting");
      setTerminalLines([`⚡ Booting WebContainer runtime…`]);

      try {
        const wc = await getWebContainer();
        if (cancelled) return;

        wcRef.current = wc;

        const tree = filesToTree(files);
        await wc.mount(tree);

        if (cancelled) return;

        appendLog(`✓ Mounted ${Object.keys(files).length} file(s) into the virtual filesystem.`);
        appendLog(`  Ready. Click "Run Tests" to install dependencies and execute the test suite.`);
        setContainerStatus("ready");
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        appendLog(`✗ Boot failed: ${msg}`);
        setContainerStatus("error");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // ── Write a file into the live container ──
  const writeToContainer = useCallback(async (filePath: string, contents: string) => {
    const wc = wcRef.current;
    if (!wc) return;
    try {
      await wc.fs.writeFile(filePath, contents);
    } catch (err: unknown) {
      console.error(`[WorkspaceIDE] fs.writeFile("${filePath}") failed:`, err);
    }
  }, []);

  // ── Handle editor changes ──
  const handleFileChange = useCallback(
    (filePath: string, value: string) => {
      setFiles((prev) => ({ ...prev, [filePath]: value }));
      writeToContainer(filePath, value);
    },
    [writeToContainer]
  );

  // ── Run npm install + npm run test ──
  const handleRunTests = useCallback(async () => {
    const wc = wcRef.current;
    if (!wc || containerStatus !== "ready") return;

    setRunStatus("installing");
    setTerminalLines([]);
    appendLog(`$ npm install`);

    try {
      // 1. npm install
      const install = await wc.spawn("npm", ["install"]);
      install.output.pipeTo(
        new WritableStream({ write: (chunk) => appendLog(chunk) })
      );
      const installCode = await install.exit;

      if (installCode !== 0) {
        appendLog(`\n✗ npm install exited with code ${installCode}`);
        setRunStatus("failed");
        return;
      }

      appendLog(`\n$ npm run test`);
      setRunStatus("testing");

      // 2. npm run test
      const test = await wc.spawn("npm", ["run", "test"]);
      test.output.pipeTo(
        new WritableStream({ write: (chunk) => appendLog(chunk) })
      );
      const testCode = await test.exit;

      if (testCode === 0) {
        appendLog(`\n✓ Test suite passed (exit 0).`);
        setRunStatus("done");
      } else {
        appendLog(`\n✗ Tests exited with code ${testCode}.`);
        setRunStatus("failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`\n✗ Execution error: ${msg}`);
      setRunStatus("failed");
    }
  }, [containerStatus, appendLog]);

  // ── Submit workspace to AI review ──
  const handleSubmitPR = useCallback(async () => {
    setIsLocked(true);
    setReviewStatus("pending");
    setReviewComments([]);
    appendLog(`\n🤖 Submitting workspace to AI Code-Review Engine…`);

    try {
      const res = await fetch("/api/sandbox/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFiles: initialFiles,
          currentFiles: files,
        }),
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errBody = (await res.json()) as { error?: string };
          if (errBody.error) errMsg = errBody.error;
        } catch {
          /* ignore parse error */
        }
        throw new Error(errMsg);
      }

      const body = (await res.json()) as { comments: ReviewComment[] };
      const comments = body.comments ?? [];

      setReviewComments(comments);
      setReviewStatus("done");
      appendLog(
        comments.length > 0
          ? `✓ Review complete — ${comments.length} comment(s) across ${
              new Set(comments.map((c) => c.filePath)).size
            } file(s).`
          : `✓ Review complete — no issues detected. Code looks good!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`✗ Review failed: ${msg}`);
      setReviewStatus("error");
      setIsLocked(false);
    }
  }, [files, initialFiles, appendLog]);

  // ── Unlock / reset review ──
  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    setReviewStatus("idle");
    setReviewComments([]);
  }, []);

  // ── File tree grouping ──
  const { rootFiles, dirs } = useMemo(
    () => groupPaths(Object.keys(files)),
    [files]
  );

  const toggleDir = (dir: string) =>
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(dir) ? next.delete(dir) : next.add(dir);
      return next;
    });

  // ── Derived state ──
  const activeContents = files[activeFile] ?? "";
  const activeComments = reviewComments.filter((c) => c.filePath === activeFile);
  const filesWithComments = new Set(reviewComments.map((c) => c.filePath));
  const isRunning = runStatus === "installing" || runStatus === "testing";
  const isReviewPending = reviewStatus === "pending";

  // ── Run-status indicator ──
  const runStatusLabel: Record<RunStatus, string> = {
    idle: "Run Tests",
    installing: "Installing…",
    testing: "Testing…",
    done: "Tests Passed",
    failed: "Tests Failed",
  };

  const runStatusIcon =
    runStatus === "done" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : isRunning ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : runStatus === "failed" ? (
      <AlertCircle className="h-3.5 w-3.5" />
    ) : (
      <Play className="h-3.5 w-3.5 fill-current" />
    );

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl min-h-[600px] h-[720px]">

      {/* ── Toolbar ── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-slate-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <FileCode2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100">{projectName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  containerStatus === "ready"
                    ? "bg-emerald-400"
                    : containerStatus === "booting"
                    ? "bg-amber-400 animate-pulse"
                    : containerStatus === "error"
                    ? "bg-rose-400"
                    : "bg-slate-600"
                }`}
              />
              <span className="text-[9px] text-slate-400 font-medium capitalize">
                {containerStatus === "booting" ? "Booting container…" : containerStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Run Tests */}
          <button
            onClick={handleRunTests}
            disabled={containerStatus !== "ready" || isRunning || isLocked}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover-lift active-press ${
              runStatus === "done"
                ? "bg-emerald-600/80 text-white hover:bg-emerald-600"
                : runStatus === "failed"
                ? "bg-rose-600/80 text-white hover:bg-rose-600"
                : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-900/20"
            }`}
          >
            {runStatusIcon}
            {runStatusLabel[runStatus]}
          </button>

          {/* Submit PR / Unlock */}
          {isLocked ? (
            <button
              onClick={handleUnlock}
              disabled={isReviewPending}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover-lift active-press transition-all cursor-pointer disabled:opacity-40"
            >
              <LockOpen className="h-3.5 w-3.5" />
              Unlock Editor
            </button>
          ) : (
            <button
              onClick={handleSubmitPR}
              disabled={containerStatus !== "ready" || isRunning}
              className="flex items-center gap-1.5 rounded-full bg-purple-600 hover:bg-purple-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-purple-900/20 hover-lift active-press transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              Submit PR
            </button>
          )}
        </div>
      </header>

      {/* ── Review status banner ── */}
      {reviewStatus === "done" && reviewComments.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 border-b border-amber-500/20 bg-amber-950/20 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-300">
            AI review found <strong>{reviewComments.length} issue(s)</strong> — click
            a file with a{" "}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />{" "}
            dot to see inline comments.{" "}
            <button onClick={handleUnlock} className="underline cursor-pointer hover:no-underline">
              Unlock to continue editing.
            </button>
          </p>
        </div>
      )}
      {reviewStatus === "done" && reviewComments.length === 0 && (
        <div className="shrink-0 flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/20 px-4 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-300">
            AI review complete — no issues detected. All changes look good!
          </p>
        </div>
      )}

      {/* ── Main area: file tree + editor ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: file tree ── */}
        <nav
          aria-label="File tree"
          className="w-44 shrink-0 overflow-y-auto border-r border-white/10 bg-slate-900/30 py-2"
        >
          {/* Root-level files */}
          {rootFiles.map((path) => (
            <FileTreeEntry
              key={path}
              path={path}
              depth={0}
              isActive={activeFile === path}
              hasDot={filesWithComments.has(path)}
              onClick={() => setActiveFile(path)}
            />
          ))}

          {/* Directories */}
          {Object.entries(dirs).map(([dir, children]) => (
            <div key={dir}>
              <button
                onClick={() => toggleDir(dir)}
                className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {expandedDirs.has(dir) ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <Folder className="h-3 w-3 shrink-0 text-indigo-400" />
                {dir}/
              </button>

              {expandedDirs.has(dir) &&
                children.map((path) => (
                  <FileTreeEntry
                    key={path}
                    path={path}
                    depth={1}
                    isActive={activeFile === path}
                    hasDot={filesWithComments.has(path)}
                    onClick={() => setActiveFile(path)}
                  />
                ))}
            </div>
          ))}
        </nav>

        {/* ── Center: code editor or review view ── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-950/60">
          {/* File tab bar */}
          <div className="flex shrink-0 items-center gap-0 border-b border-white/5 bg-slate-900/40 overflow-x-auto">
            <div className="flex items-center gap-1 px-2 py-1 min-w-max">
              <span className="text-[9px] font-mono text-slate-500">
                {activeFile}
              </span>
              {isLocked && (
                <Lock className="h-2.5 w-2.5 text-slate-600 ml-1" />
              )}
              {activeComments.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/20 text-amber-400 text-[8px] font-bold px-1.5 py-0.5 border border-amber-500/25">
                  {activeComments.length}
                </span>
              )}
            </div>
          </div>

          {/* Editor body */}
          <div className="flex-1 overflow-hidden">
            {isLocked && reviewStatus === "done" ? (
              // Review mode: line-by-line with inline callouts
              <ReviewCodeView contents={activeContents} comments={activeComments} />
            ) : (
              // Edit mode: textarea
              <CodeEditor
                filePath={activeFile}
                contents={activeContents}
                onChange={(v) => handleFileChange(activeFile, v)}
                disabled={isLocked}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: streaming terminal ── */}
      <div className="shrink-0 h-44 border-t border-white/10 flex flex-col bg-slate-900/70">
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-1.5 select-none">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <Terminal className="h-3 w-3 text-purple-400" />
            Terminal
          </span>
          <div className="flex items-center gap-2">
            {isRunning && (
              <span className="flex items-center gap-1 text-[9px] text-purple-400 animate-pulse">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                {runStatus}
              </span>
            )}
            {isReviewPending && (
              <span className="flex items-center gap-1 text-[9px] text-purple-400 animate-pulse">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                reviewing
              </span>
            )}
            <button
              onClick={() => setTerminalLines([])}
              className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            >
              clear
            </button>
          </div>
        </div>

        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[10px] leading-4 text-slate-300 space-y-px"
        >
          {terminalLines.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith("✗") || line.includes("ERR!")
                  ? "text-rose-400"
                  : line.startsWith("✓")
                  ? "text-emerald-400"
                  : line.startsWith("$") || line.startsWith("⚡") || line.startsWith("🤖")
                  ? "text-indigo-300"
                  : "text-slate-400"
              }
            >
              {line}
            </div>
          ))}
          {terminalLines.length === 0 && (
            <div className="text-slate-600 italic">
              No output yet. Run the test suite or mount your project.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FileTreeEntry ─────────────────────────────────────────────────────────────

function FileTreeEntry({
  path,
  depth,
  isActive,
  hasDot,
  onClick,
}: {
  path: string;
  depth: number;
  isActive: boolean;
  hasDot: boolean;
  onClick: () => void;
}) {
  const name = basename(path);
  const ext = name.split(".").pop() ?? "";
  const iconColor =
    ext === "ts" || ext === "tsx"
      ? "text-blue-400"
      : ext === "js" || ext === "jsx"
      ? "text-yellow-400"
      : ext === "json"
      ? "text-amber-400"
      : ext === "md"
      ? "text-slate-400"
      : "text-slate-500";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded-xl py-1 text-left text-[11px] font-semibold transition-all active-press cursor-pointer ${
        depth === 0 ? "px-3" : "pl-8 pr-3"
      } ${
        isActive
          ? "bg-indigo-600/20 text-indigo-200"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <FileCode2 className={`h-3 w-3 shrink-0 ${iconColor}`} />
      <span className="flex-1 truncate">{name}</span>
      {hasDot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
          title="Has review comments"
        />
      )}
    </button>
  );
}
