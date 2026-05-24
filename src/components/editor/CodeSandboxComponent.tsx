"use client";

import React, { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Play, Terminal, RefreshCw, AlertTriangle, Check, Loader2, Code } from "lucide-react";
import { runPythonCode, runNodeCode } from "@/lib/sandboxes/runner";

export function CodeSandboxComponent({ node, updateAttributes }: NodeViewProps) {
  const currentLanguage = node.attrs.language || "javascript";
  const [output, setOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setOutput(null);

    // Tiptap node provides textContent natively for its nested text node
    const code = node.textContent;

    try {
      let result = "";
      if (currentLanguage === "python") {
        result = await runPythonCode(code);
      } else {
        // Runs standard Node.js / JavaScript
        result = await runNodeCode(code);
      }

      // Check if standard execution output denotes custom errors
      if (
        result.includes("Python Error:") ||
        result.includes("Node.js Error:") ||
        result.includes("Traceback")
      ) {
        setError(result);
      } else {
        setOutput(result);
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setOutput(null);
    setError(null);
  };

  const setLanguage = (lang: string) => {
    updateAttributes({ language: lang });
  };

  return (
    <NodeViewWrapper className="my-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-md">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Code className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-semibold tracking-wide">Interactive Sandbox</span>
          </div>

          {/* Toggle Languages */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
            <button
              onClick={() => setLanguage("javascript")}
              className={`rounded-full px-2.5 py-1 font-bold transition hover-lift active-press cursor-pointer ${
                currentLanguage === "javascript" || currentLanguage === "nodejs"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/20"
                  : "hover:bg-white/5 hover:text-slate-200 border border-transparent"
              }`}
            >
              Node.js
            </button>
            <button
              onClick={() => setLanguage("python")}
              className={`rounded-full px-2.5 py-1 font-bold transition hover-lift active-press cursor-pointer ${
                currentLanguage === "python"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/20"
                  : "hover:bg-white/5 hover:text-slate-200 border border-transparent"
              }`}
            >
              Python (WASM)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              disabled
              className="flex items-center gap-1.5 rounded-full bg-purple-600/50 px-3 py-1.5 font-semibold text-purple-200 cursor-not-allowed select-none"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Running...</span>
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 rounded-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 px-3.5 py-1.5 font-bold text-white shadow-md shadow-purple-900/20 hover-lift active-press transition-all cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Code</span>
            </button>
          )}

          {(output || error) && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 hover-lift active-press transition text-slate-300 cursor-pointer"
              title="Clear Output"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="relative min-h-[100px] border-b border-white/5 bg-slate-950/40">
        <pre className="p-4 font-mono text-sm leading-relaxed text-slate-100 focus:outline-none">
          <NodeViewContent className="block focus:outline-none whitespace-pre-wrap outline-none" />
        </pre>
      </div>

      {/* Console output display */}
      {(output || error || isRunning) && (
        <div className="border-t border-white/10 bg-slate-900/90 p-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-white/5 mb-2 select-none">
            <span className="flex items-center gap-1">
              <Terminal className="h-3 w-3 text-purple-400" />
              Console Output
            </span>
            {error ? (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 animate-pulse" /> failed
              </span>
            ) : isRunning ? (
              <span className="text-purple-400 animate-pulse">executing...</span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> success
              </span>
            )}
          </div>

          {isRunning && (
            <div className="text-slate-400 animate-pulse py-1">
              Bootstrapping environment and executing in browser sandbox...
            </div>
          )}

          {error && (
            <pre className="overflow-x-auto whitespace-pre-wrap text-red-400 py-1 bg-red-950/20 rounded-xl p-2.5 border border-red-500/20">
              {error}
            </pre>
          )}

          {output && (
            <pre className="overflow-x-auto whitespace-pre-wrap text-emerald-400 py-1 bg-emerald-950/10 rounded-xl p-2.5 border border-emerald-500/10">
              {output}
            </pre>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
