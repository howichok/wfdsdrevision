"use client";

import React, { useEffect, useRef } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Sparkles,
  Send,
  RefreshCw,
  AlertCircle,
  X,
  Bot,
  User,
  Terminal,
  Code2,
  BookOpen
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface CopilotSidebarProps {
  lessonId: string;
  currentCode: string;
  lastErrorLog: string | null;
  onClose?: () => void;
  fallbackLessonTitle?: string;
  fallbackLessonContent?: string;
}

export function CopilotSidebar({
  lessonId,
  currentCode,
  lastErrorLog,
  onClose,
  fallbackLessonTitle,
  fallbackLessonContent,
}: CopilotSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = React.useState("");
  const [mode, setMode] = React.useState<"tutor" | "socratic" | "feynman" | "review">("tutor");

  const stateRef = useRef({
    lessonId,
    currentCode,
    lastErrorLog,
    fallbackLessonTitle,
    fallbackLessonContent,
    mode,
  });

  useEffect(() => {
    stateRef.current = {
      lessonId,
      currentCode,
      lastErrorLog,
      fallbackLessonTitle,
      fallbackLessonContent,
      mode,
    };
  }, [lessonId, currentCode, lastErrorLog, fallbackLessonTitle, fallbackLessonContent, mode]);

  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat/copilot",
      body: () => stateRef.current,
    });
  }, []);

  const {
    messages,
    status,
    error,
    sendMessage,
    regenerate,
    stop,
    setMessages
  } = useChat({
    transport,
    onError: (err: any) => {
      console.error("[Copilot Sidebar] useChat error:", err);
      toast.error(`AI Tutor error: ${err.message || "Failed to stream response"}`);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto scroll to bottom when messages stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSuggestion = async (promptText: string) => {
    if (isLoading) return;
    try {
      await sendMessage({ text: promptText });
    } catch (err: any) {
      console.error("[Copilot Sidebar] handleSuggestion failed:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (input.trim() && !isLoading) {
      const textToSend = input;
      setInput("");
      try {
        await sendMessage({ text: textToSend });
      } catch (err: any) {
        console.error("[Copilot Sidebar] sendMessage failed:", err);
      }
    }
  };

  const clearChat = () => {
    if (confirm("Are you sure you want to clear this conversation history?")) {
      setMessages([]);
    }
  };

  const getMessageText = (msg: UIMessage) => {
    return msg.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[500px] rounded-2xl border border-white/10 bg-slate-900/30 shadow-2xl backdrop-blur-lg overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col border-b border-white/10 bg-slate-950/60 p-4 gap-3 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                AI Tutor Copilot
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] text-slate-400 font-medium">
                  Context Caching Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="px-3 py-1 rounded-full text-[10px] text-slate-400 hover:bg-white/5 hover:text-white hover-lift active-press transition-all cursor-pointer"
                title="Clear conversation"
              >
                Reset Chat
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:bg-white/5 hover:text-white hover-lift active-press transition-all cursor-pointer"
                title="Collapse sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 bg-slate-900/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 shrink-0">
            Mode:
          </span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="flex-1 bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-purple-500/40 hover:bg-slate-950 transition-all font-medium cursor-pointer"
          >
            <option value="tutor">🎓 Tutor (Default)</option>
            <option value="socratic">🤔 Socratic Guide</option>
            <option value="feynman">👶 Feynman Learner</option>
            <option value="review">🔍 Error Review</option>
          </select>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/10">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full justify-between py-6">
            <div className="flex flex-col items-center justify-center text-center p-6 my-auto select-none">
              <Bot className="h-10 w-10 text-purple-400 mb-3.5 animate-bounce" />
              <h4 className="text-xs font-bold text-slate-200">Meet Your Programming Tutor</h4>
              <p className="text-[11px] text-slate-400 max-w-[240px] mt-2 leading-relaxed">
                I can help you review syntax, identify logical gaps, or interpret errors. Ask me anything about the lesson!
              </p>
            </div>

            {/* Suggestions list */}
            <div className="space-y-2 mt-4 px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none block px-1">
                Quick Suggestions
              </span>
              <button
                onClick={() => handleSuggestion("I'm a bit stuck. How should I get started on this challenge?")}
                className="w-full text-left rounded-2xl border border-white/5 bg-slate-950/30 hover:bg-slate-950/60 p-3.5 text-xs text-slate-300 hover:text-white hover-lift active-press transition-all duration-205 cursor-pointer flex items-start gap-2.5"
              >
                <BookOpen className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <span>How should I get started on this challenge?</span>
              </button>

              {lastErrorLog && (
                <button
                  onClick={() => handleSuggestion("I am running into a test suite failure. Can you explain the issue without giving away the code solution?")}
                  className="w-full text-left rounded-2xl border border-rose-500/20 bg-rose-950/10 hover:bg-rose-950/20 p-3.5 text-xs text-rose-300 hover:text-rose-200 hover-lift active-press transition-all duration-205 cursor-pointer flex items-start gap-2.5"
                >
                  <Terminal className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Explain my current execution error</span>
                </button>
              )}

              {currentCode && currentCode.trim().length > 0 && (
                <button
                  onClick={() => handleSuggestion("Can you review my current editor code for logical flaws or bugs without providing the complete solution?")}
                  className="w-full text-left rounded-2xl border border-purple-500/20 bg-purple-950/10 hover:bg-purple-950/20 p-3.5 text-xs text-purple-300 hover:text-purple-200 hover-lift active-press transition-all duration-205 cursor-pointer flex items-start gap-2.5"
                >
                  <Code2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>Review my code for logical flaws</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message: UIMessage) => {
              const isAi = message.role === "assistant";
              const messageText = getMessageText(message);
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 text-xs leading-relaxed ${
                    isAi ? "justify-start" : "justify-end"
                  }`}
                >
                  {/* Left Avatar for Assistant */}
                  {isAi && (
                    <div className="h-7 w-7 rounded-full bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[85%] border shadow-lg ${
                      isAi
                        ? "bg-slate-900/40 border-white/5 text-slate-200"
                        : "bg-purple-600/90 border-purple-500/30 text-white"
                    }`}
                  >
                    {/* User message title or simple markdown */}
                    {isAi ? (
                      <div className="prose prose-invert prose-xs max-w-none text-slate-200 font-normal space-y-2">
                        <ReactMarkdown
                          components={{
                            code({ node, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || "");
                              const isInline = !match;
                              return isInline ? (
                                <code className="bg-slate-950/80 border border-white/5 px-1 py-0.5 rounded text-purple-300 font-mono text-[10px]" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="bg-slate-950 border border-white/5 p-2 rounded-lg my-1.5 overflow-x-auto text-[10px] font-mono text-slate-300 leading-normal">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              );
                            },
                          }}
                        >
                          {messageText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      // Clean output for User messages (stripping workspace details if they are shown, so the history is clean to read for the student)
                      <p className="whitespace-pre-wrap select-text">
                        {messageText.includes("[STUDENT WORKSPACE STATE]")
                          ? messageText.split("[STUDENT QUESTION]\n")[1] || messageText
                          : messageText}
                      </p>
                    )}
                  </div>

                  {/* Right Avatar for User */}
                  {!isAi && (
                    <div className="h-7 w-7 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Error indicators or loading spinners */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3 text-xs justify-start items-center">
                <div className="h-7 w-7 rounded-lg bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-slate-900/40 border border-white/5 text-slate-400 flex items-center gap-2 select-none">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-950/15 p-3 flex gap-2 text-red-400 text-xs select-none">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Streaming Connection Interrupted</p>
                  <button
                    onClick={() => regenerate()}
                    className="mt-1.5 px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-900/60 border border-red-500/20 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Retry Last Query
                  </button>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input panel */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 bg-slate-950/60 p-3 flex gap-2 select-none items-end"
      >
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !isLoading) {
                const form = e.currentTarget.form;
                if (form) {
                  const event = new Event("submit", { cancelable: true, bubbles: true });
                  form.dispatchEvent(event);
                }
              }
            }
          }}
          disabled={isLoading}
          rows={1}
          placeholder="Ask a question..."
          className="flex-1 resize-none rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-purple-500/40 transition-all font-sans leading-relaxed min-h-[36px] max-h-[120px] smooth-input"
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="h-9 w-9 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white hover-lift active-press transition-all disabled:opacity-40 cursor-pointer shadow-lg shrink-0"
        >
          {isLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 fill-current" />
          )}
        </button>
      </form>
    </div>
  );
}
