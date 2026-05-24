"use client";

/**
 * TextHighlighterEngine
 *
 * "Smart Client, Dumb Server" ink-highlighter for student essay feedback.
 *
 * Architecture:
 *   1. Calls POST /api/exam/evaluate-text via fetch — receives SSE events.
 *   2. Each SSE event is a single, fully-formed annotation JSON object.
 *   3. The DOM Parsing Engine (applyHighlight) finds the targetText in the
 *      current plain-text segments and splits it into [before, mark, after].
 *   4. Segment IDs are stable — React only mounts NEW <mark> elements, which
 *      triggers the CSS drawInkLine animation once on entry.
 */

import {
  useState,
  useRef,
  useCallback,
  memo,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Sparkles, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import type { EvalAnnotation } from "@/app/api/exam/evaluate-text/route";

// ─── Segment model ────────────────────────────────────────────────────────────

type PlainSeg = { kind: "plain"; id: string; content: string };
type MarkSeg = {
  kind: "mark";
  id: string;
  content: string;
  markType: "highlight_good" | "highlight_bad";
  feedback: string;
};
type Segment = PlainSeg | MarkSeg;

// Monotonic counter — guarantees unique segment IDs within a browser session.
let _seg = 0;
const sid = () => `seg-${++_seg}`;

function initSegments(text: string): Segment[] {
  return [{ kind: "plain", id: sid(), content: text }];
}

// ─── DOM Parsing Engine ───────────────────────────────────────────────────────

/**
 * Locates `ann.targetText` inside the first unhighlighted plain segment that
 * contains it, then splits that segment into [before | mark | after].
 * Only the FIRST occurrence is highlighted per call to mirror the stream ordering.
 */
function applyHighlight(segments: Segment[], ann: EvalAnnotation): Segment[] {
  const { targetText, type, feedback } = ann;
  if (!targetText) return segments;

  const out: Segment[] = [];
  let applied = false;

  for (const seg of segments) {
    if (!applied && seg.kind === "plain") {
      const idx = seg.content.indexOf(targetText);
      if (idx !== -1) {
        applied = true;
        if (idx > 0) {
          out.push({ kind: "plain", id: sid(), content: seg.content.slice(0, idx) });
        }
        out.push({
          kind: "mark",
          id: sid(),
          content: targetText,
          markType: type,
          feedback,
        });
        const tail = seg.content.slice(idx + targetText.length);
        if (tail) {
          out.push({ kind: "plain", id: sid(), content: tail });
        }
        continue;
      }
    }
    out.push(seg);
  }

  return out;
}

// ─── Ink Mark + Tooltip ───────────────────────────────────────────────────────

/**
 * Rendered once per MarkSeg. Memoised so neighbouring plain-text re-renders
 * don't disturb already-mounted marks (and re-trigger their CSS animation).
 */
const InkMark = memo(function InkMark({
  content,
  markType,
  feedback,
}: Pick<MarkSeg, "content" | "markType" | "feedback">) {
  const [open, setOpen] = useState(false);

  const isGood = markType === "highlight_good";
  const tooltipCls = isGood
    ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100 shadow-emerald-900/20"
    : "border-amber-500/30 bg-amber-950/95 text-amber-100 shadow-amber-900/20";
  const labelCls = isGood ? "text-emerald-400" : "text-amber-400";
  const label = isGood ? "✓ Strong point" : "⚠ Needs work";

  return (
    <span className="relative inline">
      {/* The <mark> element — animation fires once on mount via CSS */}
      <mark
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        aria-label={`${label}: ${feedback}`}
        className={cn(
          // Reset browser <mark> yellow; let our CSS gradient do the colouring
          "bg-transparent text-inherit cursor-help",
          "rounded-[3px] px-0.5",
          // Hardware-accelerated ink animation — defined in globals.css
          "animate-live-ink",
          isGood ? "ink-good" : "ink-bad"
        )}
      >
        {content}
      </mark>

      {/* Tooltip — CSS-positioned, pointer-events:none so it doesn't steal hover */}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute bottom-full left-0 z-50 mb-2 w-max max-w-[220px]",
            "rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed",
            "shadow-xl pointer-events-none",
            tooltipCls
          )}
        >
          <span className={cn("mb-1 block text-[9px] font-bold uppercase tracking-widest", labelCls)}>
            {label}
          </span>
          {feedback}
        </span>
      )}
    </span>
  );
});

// ─── Legend chip ──────────────────────────────────────────────────────────────

function LegendChip({
  type,
  count,
}: {
  type: "highlight_good" | "highlight_bad";
  count: number;
}) {
  const isGood = type === "highlight_good";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border",
        isGood
          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
          : "bg-amber-500/10 border-amber-500/25 text-amber-400"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isGood ? "bg-emerald-400" : "bg-amber-400"
        )}
      />
      {count} {isGood ? "strong" : "needs work"}
    </span>
  );
}

// ─── SSE stream reader ────────────────────────────────────────────────────────

async function* readAnnotationStream(
  resp: Response
): AsyncGenerator<EvalAnnotation | { error: string }> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          yield JSON.parse(payload) as EvalAnnotation | { error: string };
        } catch {
          // malformed chunk — skip
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface TextHighlighterEngineProps {
  /** The student's full essay / answer text. */
  essayText: string;
  /** Optional exam question for richer AI context. */
  questionText?: string;
  className?: string;
}

type Phase = "idle" | "streaming" | "done" | "error";

export function TextHighlighterEngine({
  essayText,
  questionText,
  className,
}: TextHighlighterEngineProps) {
  const [segments, setSegments] = useState<Segment[]>(() =>
    initSegments(essayText)
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Abort controller lets the Stop button cancel the fetch + generator loop.
  const abortRef = useRef<AbortController | null>(null);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const goodCount = segments.filter(
    (s) => s.kind === "mark" && s.markType === "highlight_good"
  ).length;
  const badCount = segments.filter(
    (s) => s.kind === "mark" && s.markType === "highlight_bad"
  ).length;

  // ── Reset helper ────────────────────────────────────────────────────────────
  const reset = useCallback(
    (text = essayText) => {
      abortRef.current?.abort();
      setSegments(initSegments(text));
      setPhase("idle");
      setErrorMsg("");
    },
    [essayText]
  );

  // ── Analyze handler ─────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setSegments(initSegments(essayText));
    setPhase("streaming");
    setErrorMsg("");

    let resp: Response;
    try {
      resp = await fetch("/api/exam/evaluate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: essayText, questionText }),
        signal: ac.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg("Network error — could not reach the analysis server.");
      setPhase("error");
      return;
    }

    if (!resp.ok) {
      setErrorMsg(`Server error ${resp.status}`);
      setPhase("error");
      return;
    }

    try {
      for await (const event of readAnnotationStream(resp)) {
        if (ac.signal.aborted) break;

        if ("error" in event) {
          setErrorMsg(event.error);
          setPhase("error");
          return;
        }

        // Apply the annotation to the segment tree — stable IDs ensure React
        // only mounts the NEW <mark> node, triggering its CSS animation once.
        setSegments((prev) => applyHighlight(prev, event));
      }
      setPhase(ac.signal.aborted ? "idle" : "done");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setPhase("idle");
      } else {
        setErrorMsg("Stream read error. Please try again.");
        setPhase("error");
      }
    }
  }, [essayText, questionText]);

  // ── Stop handler ────────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setPhase("done");
  }, []);

  const isStreaming = phase === "streaming";
  const isDone = phase === "done";
  const isError = phase === "error";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-4", className)}>

      {/* ── Control bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isDone && goodCount > 0 && (
            <LegendChip type="highlight_good" count={goodCount} />
          )}
          {isDone && badCount > 0 && (
            <LegendChip type="highlight_bad" count={badCount} />
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && (
            <button
              onClick={handleStop}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border/30 px-3 text-xs text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
            >
              Stop
            </button>
          )}
          {isDone && (
            <button
              onClick={() => reset()}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border/30 px-3 text-xs text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          <button
            onClick={isStreaming ? handleStop : handleAnalyze}
            disabled={false}
            className={cn(
              "flex h-8 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-all",
              isStreaming
                ? "bg-primary/50 text-primary-foreground/80 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/10"
            )}
          >
            {isStreaming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing…
              </>
            ) : isDone ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Re-analyze
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Analyze Essay
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {isError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
          <button
            onClick={handleAnalyze}
            className="ml-auto underline hover:no-underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Live streaming indicator ─────────────────────────────────────────── */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          AI is marking your essay live…
        </div>
      )}

      {/* ── Essay body with live ink highlights ──────────────────────────────── */}
      <div
        className={cn(
          "relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm",
          "p-6 text-sm leading-loose whitespace-pre-wrap font-[inherit]",
          "text-foreground/90 selection:bg-primary/20"
        )}
      >
        {renderSegments(segments)}
      </div>

      {/* ── Bottom legend ────────────────────────────────────────────────────── */}
      {isDone && (goodCount > 0 || badCount > 0) && (
        <div className="flex flex-wrap items-center gap-5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="ink-good animate-live-ink inline-block h-2.5 w-7 rounded-sm" />
            Strong content
          </span>
          <span className="flex items-center gap-1.5">
            <span className="ink-bad animate-live-ink inline-block h-2.5 w-7 rounded-sm" />
            Needs improvement
          </span>
          <span className="ml-auto text-[9px] text-muted-foreground/50">
            Hover any highlight for feedback
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Render helper (outside component to avoid closure capture) ───────────────

function renderSegments(segments: Segment[]): ReactNode[] {
  return segments.map((seg) =>
    seg.kind === "plain" ? (
      <span key={seg.id}>{seg.content}</span>
    ) : (
      <InkMark
        key={seg.id}
        content={seg.content}
        markType={seg.markType}
        feedback={seg.feedback}
      />
    )
  );
}
