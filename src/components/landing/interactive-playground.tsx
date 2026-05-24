"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloudLightning,
  Brain,
  LineChart,
  ArrowRight,
  Sparkles,
  MessageSquare,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  FileText,
  User,
  Settings
} from "lucide-react";

// Tab types
type TabId = "teams-sync" | "socratic-chat" | "parsons-puzzle" | "diagnostics";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const tabItems: TabItem[] = [
  {
    id: "teams-sync",
    label: "Teams Sync",
    icon: CloudLightning,
    description: "Automated scanning of classroom handouts, posts, and announcements."
  },
  {
    id: "socratic-chat",
    label: "Socratic Chat",
    icon: Brain,
    description: "AI-guided revision prompts that help you recall concepts step-by-step."
  },
  {
    id: "parsons-puzzle",
    label: "Parsons Puzzle",
    icon: Settings,
    description: "Drag/click code block sorting to reconstruct executable syntax."
  },
  {
    id: "diagnostics",
    label: "Diagnostic Gaps",
    icon: LineChart,
    description: "AI grading and concept mastery analysis highlighting revision targets."
  }
];

// Socratic tutor dialogue states
interface ChatMessage {
  sender: "tutor" | "student";
  text: string;
  options?: string[];
}

const initialChatMessages: ChatMessage[] = [
  {
    sender: "tutor",
    text: "Let's review SQL Joins! If we want to retrieve *all* customer records, even those who have never placed an order, which JOIN should we use?",
    options: ["INNER JOIN", "LEFT JOIN", "CROSS JOIN"]
  }
];

export function InteractivePlayground() {
  const [activeTab, setActiveTab] = React.useState<TabId>("teams-sync");
  const tabListRef = React.useRef<HTMLDivElement>(null);

  // Tab Keyboard Navigation (WCAG 2.1.1 compliant)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let newIndex = index;
    if (e.key === "ArrowRight") {
      newIndex = (index + 1) % tabItems.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (index - 1 + tabItems.length) % tabItems.length;
    } else {
      return;
    }

    e.preventDefault();
    const nextTabId = tabItems[newIndex].id;
    setActiveTab(nextTabId);

    // Focus the next button
    if (tabListRef.current) {
      const buttons = tabListRef.current.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[newIndex]?.focus();
    }
  };

  // 1. Teams Sync Demo State
  const [syncStep, setSyncStep] = React.useState<"idle" | "scanning" | "synced">("idle");
  const handleStartSync = () => {
    setSyncStep("scanning");
    setTimeout(() => {
      setSyncStep("synced");
    }, 2500);
  };
  const handleResetSync = () => {
    setSyncStep("idle");
  };

  // 2. Socratic Chat Demo State
  const [chatLog, setChatLog] = React.useState<ChatMessage[]>(initialChatMessages);
  const handleSelectOption = (option: string) => {
    const nextLog = [...chatLog];
    // Remove options from the last message
    if (nextLog.length > 0) {
      nextLog[nextLog.length - 1] = { ...nextLog[nextLog.length - 1], options: undefined };
    }

    // Add student message
    nextLog.push({ sender: "student", text: option });

    // Add tutor response based on answer
    setTimeout(() => {
      let tutorText = "";
      let options: string[] | undefined = undefined;

      if (option === "INNER JOIN") {
        tutorText = "Not quite! An INNER JOIN only returns rows where there is a matching record in *both* tables. If a customer has no orders, they won't appear. What join returns all rows from the primary (left) table?";
        options = ["LEFT JOIN", "CROSS JOIN"];
      } else if (option === "LEFT JOIN") {
        tutorText = "Spot on! A LEFT JOIN retrieves all records from the left table (Customers) regardless of whether they have a matching record in the right table. Excellent conceptual recall!";
      } else {
        tutorText = "A CROSS JOIN generates a Cartesian product of both tables, matching every row with every other row. Think about which join retrieves all items from the primary left table.";
        options = ["INNER JOIN", "LEFT JOIN"];
      }

      setChatLog((prev) => [...prev, { sender: "tutor", text: tutorText, options }]);
    }, 800);

    setChatLog(nextLog);
  };

  const handleResetChat = () => {
    setChatLog(initialChatMessages);
  };

  // 3. Parsons Puzzle Demo State
  // Initial scrambled lines of code
  const initialPuzzleLines = [
    { id: "line-3", text: "  for x in numbers", correctIdx: 2 },
    { id: "line-1", text: "numbers = [1, 2, 3, 4]", correctIdx: 0 },
    { id: "line-4", text: "]", correctIdx: 3 },
    { id: "line-2", text: "evens = [x * 2", correctIdx: 1 }
  ];

  const [puzzleLines, setPuzzleLines] = React.useState(initialPuzzleLines);
  const [puzzleStatus, setPuzzleStatus] = React.useState<"idle" | "success" | "error">("idle");

  const moveLine = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === puzzleLines.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const lines = [...puzzleLines];
    const temp = lines[index];
    lines[index] = lines[newIndex];
    lines[newIndex] = temp;

    setPuzzleLines(lines);
    setPuzzleStatus("idle");
  };

  const checkPuzzle = () => {
    const isCorrect = puzzleLines.every((line, idx) => line.correctIdx === idx);
    setPuzzleStatus(isCorrect ? "success" : "error");
  };

  const resetPuzzle = () => {
    setPuzzleLines(initialPuzzleLines);
    setPuzzleStatus("idle");
  };

  // 4. Diagnostics Demo State
  const [selectedTopic, setSelectedTopic] = React.useState<string | null>(null);

  return (
    <section 
      id="playground-section"
      className="py-20 px-6 sm:py-28 bg-transparent border-b border-slate-200/80"
      aria-labelledby="playground-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
            <span>Interactive Platform Demo</span>
          </div>
          <h2 id="playground-heading" className="text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900 mb-4">
            Experience Revise AI in Action
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600">
            Click through our active study panels below to see how we automate revision, guide recall, and track concept gaps.
          </p>
        </div>

        {/* Tab Controls (WCAG 2.1.1 tablist) */}
        <div 
          ref={tabListRef}
          role="tablist" 
          aria-label="Features Showcase Tabs"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-8 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 max-w-4xl mx-auto backdrop-blur-xs"
        >
          {tabItems.map((tab, idx) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  isSelected 
                    ? "bg-[#0a356c] text-white shadow-md shadow-blue-900/5" 
                    : "text-slate-605 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div className="max-w-4xl mx-auto min-h-[460px] flex">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={0}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_4px_30px_-4px_rgba(148,163,184,0.12)] flex flex-col justify-between focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-350"
            >
              {/* PANEL 1: TEAMS SYNC */}
              {activeTab === "teams-sync" && (
                <div className="flex flex-col h-full justify-between gap-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <CloudLightning className="text-[#0a356c] h-5 w-5" />
                      Classroom Microsoft Teams Sync
                    </h3>
                    <p className="text-sm text-slate-650 mt-2 max-w-2xl">
                      Revise AI syncs class resources in real-time. Below, simulate syncing a teacher's homework announcement and document slide decks directly.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-7 items-center gap-6 py-4">
                    {/* Left: Mock MS Teams Post */}
                    <div className="md:col-span-3 border border-slate-200 bg-slate-50/50 p-4 rounded-2xl">
                      <div className="flex items-center gap-3 border-b border-slate-200/60 pb-3 mb-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                          T
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Mr. Jenkins</p>
                          <p className="text-[10px] text-slate-505">Class Announcement • 9:41 AM</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-sans mb-3">
                        Hi everyone, I have uploaded the slides for our Database Schema Design lesson. Make sure to complete the normalization practice before next Wednesday's session.
                      </p>
                      <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-2.5">
                        <FileText className="h-5 w-5 text-indigo-500 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-slate-800 truncate">databases_slides.pdf</p>
                          <p className="text-[8px] text-slate-550">1.8 MB • Attached</p>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Flow Connector */}
                    <div className="md:col-span-1 flex flex-col items-center justify-center gap-2">
                      {syncStep === "idle" && (
                        <button
                          onClick={handleStartSync}
                          className="h-10 w-10 rounded-full bg-[#0a356c] flex items-center justify-center text-white hover:scale-105 transition-transform shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a356c] cursor-pointer"
                          aria-label="Start sync simulation"
                        >
                          <ArrowRight className="h-5 w-5" />
                        </button>
                      )}
                      {syncStep === "scanning" && (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full border-2 border-[#0a356c] border-t-transparent animate-spin" />
                          <span className="text-[10px] text-[#0a356c] font-bold font-mono">SCANNING</span>
                        </div>
                      )}
                      {syncStep === "synced" && (
                        <button
                          onClick={handleResetSync}
                          className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
                          aria-label="Reset sync simulation"
                        >
                          <RotateCcw className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>

                    {/* Right: Mock Revise AI Card */}
                    <div className="md:col-span-3 flex justify-center">
                      <div className="w-full relative min-h-[170px] flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          {syncStep !== "synced" ? (
                            <motion.div 
                              key="empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-center p-6 border border-dashed border-slate-200 rounded-2xl w-full h-full flex flex-col items-center justify-center bg-slate-50/50"
                            >
                              <CloudLightning className="h-8 w-8 text-slate-350 mb-2" />
                              <p className="text-xs text-slate-500 font-semibold">Workspace is empty.</p>
                              <p className="text-[10px] text-slate-505 mt-1">Start sync to import materials.</p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="card"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="w-full border border-slate-200 bg-slate-50/80 rounded-2xl overflow-hidden shadow-sm"
                            >
                              {/* visual banner */}
                              <div className="h-16 bg-gradient-to-r from-[#0d3460] to-[#1a5ba3] flex items-center px-4 justify-between">
                                <span className="text-[10px] font-bold bg-white/15 text-white rounded-full px-2 py-0.5 uppercase tracking-wider">Database Systems</span>
                                <Sparkles className="h-4 w-4 text-amber-300" />
                              </div>
                              <div className="p-4">
                                <p className="text-[10px] text-[#0a356c] font-bold">LATEST IMPORT</p>
                                <h4 className="text-xs font-bold text-slate-900 mt-1">Syllabus Node: Schema Normalization</h4>
                                <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-3">
                                  <span className="text-[9px] text-slate-550">4 concept recall nodes</span>
                                  <span className="text-[10px] font-bold text-[#0a356c] flex items-center gap-1">
                                    Learn with AI <ArrowRight className="h-3 w-3" />
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-6">
                    <span className="text-xs text-slate-555 font-medium">Synced materials are offline-cached in IndexedDB instantly.</span>
                    <button 
                      onClick={handleStartSync}
                      disabled={syncStep === "scanning"}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#0a356c] hover:underline focus-visible:ring-2 focus-visible:ring-[#0a356c] rounded cursor-pointer disabled:opacity-50"
                    >
                      {syncStep === "synced" ? "Simulate Sync Again" : "Trigger Mock Sync"} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL 2: SOCRATIC CHAT */}
              {activeTab === "socratic-chat" && (
                <div className="flex flex-col h-full justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Brain className="text-[#0a356c] h-5 w-5" />
                      AI Socratic Tutoring Sandbox
                    </h3>
                    <p className="text-sm text-slate-655 mt-2 max-w-2xl">
                      Experience Socratic mode. Revise AI prompts you with targeted questions rather than giving direct answers, building memory pathways.
                    </p>
                  </div>

                  {/* Chat interface */}
                  <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-4 flex flex-col justify-between min-h-[220px]">
                    <div className="space-y-3 overflow-y-auto max-h-[160px] text-xs font-sans">
                      {chatLog.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-3 max-w-[85%] ${
                            msg.sender === "student" ? "ml-auto flex-row-reverse" : ""
                          }`}
                        >
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            msg.sender === "tutor" ? "bg-[#0a356c] text-white" : "bg-slate-200 text-slate-700"
                          }`}>
                            {msg.sender === "tutor" ? "AI" : "ME"}
                          </div>
                          <div className={`p-3 rounded-2xl ${
                            msg.sender === "tutor" 
                              ? "bg-white border border-slate-200 text-slate-800" 
                              : "bg-[#0a356c] text-white shadow-xs"
                          }`}>
                            <p className="leading-relaxed">{msg.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Predefined Student Response Toggles */}
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap gap-2 justify-center">
                      {chatLog[chatLog.length - 1]?.options ? (
                        chatLog[chatLog.length - 1].options?.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleSelectOption(option)}
                            className="text-xs font-semibold px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-xl transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-405"
                          >
                            {option}
                          </button>
                        ))
                      ) : (
                        <button
                          onClick={handleResetChat}
                          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Restart Revision Quiz
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-6">
                    <span className="text-xs text-slate-555 font-medium">Tutors sync automatically with your classroom syllabus boundaries.</span>
                    <button 
                      onClick={handleResetChat}
                      className="text-sm font-semibold text-slate-500 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 rounded cursor-pointer"
                    >
                      Reset AI Session
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL 3: PARSONS PUZZLE */}
              {activeTab === "parsons-puzzle" && (
                <div className="flex flex-col h-full justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Settings className="text-[#0a356c] h-5 w-5" />
                      Playable Parsons Code Puzzle
                    </h3>
                    <p className="text-sm text-slate-655 mt-2 max-w-2xl">
                      Reorder lines of code using sorting triggers. Build memory recall for syntax execution flow.
                    </p>
                  </div>

                  {/* Puzzle Board */}
                  <div className="space-y-2 py-2">
                    <p className="text-xs font-semibold text-slate-700 font-mono mb-2">
                      # Goal: Double each number in a list in Python
                    </p>
                    <div className="space-y-2">
                      {puzzleLines.map((line, index) => (
                        <div 
                          key={line.id}
                          className="flex items-center justify-between gap-4 p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-mono text-xs text-slate-800 select-none"
                        >
                          <span className="whitespace-pre truncate">{line.text}</span>
                          <div className="flex items-center gap-1">
                            <button
                              disabled={index === 0}
                              onClick={() => moveLine(index, "up")}
                              aria-label={`Move line ${index + 1} up`}
                              className="h-7 w-7 rounded-lg bg-slate-50 border border-slate-200 text-slate-550 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              disabled={index === puzzleLines.length - 1}
                              onClick={() => moveLine(index, "down")}
                              aria-label={`Move line ${index + 1} down`}
                              className="h-7 w-7 rounded-lg bg-slate-50 border border-slate-200 text-slate-550 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 justify-center mt-4">
                      <button
                        onClick={checkPuzzle}
                        className="text-xs font-bold px-5 py-2.5 bg-[#0a356c] hover:bg-[#072a56] text-white rounded-xl shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        Verify Order
                      </button>
                      <button
                        onClick={resetPuzzle}
                        className="text-xs font-semibold px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 rounded-xl transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        Scramble Puzzle
                      </button>
                    </div>

                    {/* Result alert */}
                    <div className="min-h-[40px] flex items-center justify-center text-xs mt-2">
                      {puzzleStatus === "success" && (
                        <span className="text-emerald-600 flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="h-4 w-4" /> Syntactically Correct! Excellent ordering work.
                        </span>
                      )}
                      {puzzleStatus === "error" && (
                        <span className="text-rose-600 flex items-center gap-1.5 font-semibold">
                          <XCircle className="h-4 w-4" /> Reordering required. Check sequence indentation!
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
                    <span className="text-xs text-slate-555 font-medium">Revise AI parses coding sandbox exercises into interactive puzzles.</span>
                    <button 
                      onClick={resetPuzzle}
                      className="text-sm font-semibold text-slate-500 hover:text-slate-805 focus-visible:ring-2 focus-visible:ring-[#0a356c] rounded cursor-pointer"
                    >
                      Reset Puzzle
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL 4: DIAGNOSTICS */}
              {activeTab === "diagnostics" && (
                <div className="flex flex-col h-full justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <LineChart className="text-[#0a356c] h-5 w-5" />
                      AI Grading & Concept Gaps
                    </h3>
                    <p className="text-sm text-slate-655 mt-2 max-w-2xl">
                      Exams are automatically graded against assessment rubrics. Interactive mastery tags display details on diagnosed learning gaps.
                    </p>
                  </div>

                  {/* Mock Dashboard Layout */}
                  <div className="grid sm:grid-cols-5 items-center gap-6 py-2">
                    {/* Ring score */}
                    <div className="sm:col-span-2 flex flex-col items-center justify-center border border-slate-200 bg-slate-50/50 p-5 rounded-2xl text-center">
                      <p className="text-[10px] font-bold text-slate-500 tracking-wider">MOCK EXAM AVERAGE</p>
                      
                      <div className="relative h-24 w-24 flex items-center justify-center mt-3">
                        {/* Circle SVG */}
                        <svg className="absolute inset-0 h-full w-full -rotate-90">
                          <circle 
                            cx="48" 
                            cy="48" 
                            r="40" 
                            stroke="currentColor" 
                            strokeWidth="8"
                            className="text-slate-200"
                            fill="transparent"
                          />
                          <circle 
                            cx="48" 
                            cy="48" 
                            r="40" 
                            stroke="currentColor" 
                            strokeWidth="8"
                            className="text-[#0a356c]"
                            fill="transparent"
                            strokeDasharray="251"
                            strokeDashoffset="75" // 70% filled
                          />
                        </svg>
                        <span className="text-2xl font-black text-slate-900">70%</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-3">Computed across 3 mock topics</p>
                    </div>

                    {/* Topic lists */}
                    <div className="sm:col-span-3 space-y-3">
                      <p className="text-[10px] font-bold text-slate-555 tracking-wider mb-2">CONCEPT MASTERY DETAIL</p>
                      
                      {/* Topic 1 */}
                      <button
                        onClick={() => setSelectedTopic(selectedTopic === "joins" ? null : "joins")}
                        className={`w-full text-left p-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a356c] cursor-pointer ${
                          selectedTopic === "joins" ? "border-[#0a356c] bg-blue-50/15" : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">1. SQL Joins Query Syntax</span>
                          <span className="text-xs font-bold text-emerald-600">88%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: "88%" }} />
                        </div>
                        {selectedTopic === "joins" && (
                          <motion.p 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="text-[10px] text-slate-600 mt-2 leading-relaxed"
                          >
                            AI Critique: Strong understanding of basic join filters. Retests verify excellent syntax recall.
                          </motion.p>
                        )}
                      </button>

                      {/* Topic 2 */}
                      <button
                        onClick={() => setSelectedTopic(selectedTopic === "normal" ? null : "normal")}
                        className={`w-full text-left p-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a356c] cursor-pointer ${
                          selectedTopic === "normal" ? "border-[#0a356c] bg-blue-50/15" : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">2. Normalization Rules (1NF, 2NF, 3NF)</span>
                          <span className="text-xs font-bold text-amber-600">45%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full animate-pulse" style={{ width: "45%" }} />
                        </div>
                        {selectedTopic === "normal" && (
                          <motion.p 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="text-[10px] text-slate-600 mt-2 leading-relaxed"
                          >
                            AI Gap Alert: Inconsistent recall of partial functional dependencies (2NF). Click studies to generate active code sorting practice for this gap.
                          </motion.p>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-6">
                    <span className="text-xs text-slate-555 font-medium">Click topics to display detailed AI critiques and learning suggestions.</span>
                    <button 
                      onClick={() => setSelectedTopic(null)}
                      className="text-sm font-semibold text-slate-500 hover:text-slate-805 focus-visible:ring-2 focus-visible:ring-[#0a356c] rounded cursor-pointer"
                    >
                      Clear Highlights
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
