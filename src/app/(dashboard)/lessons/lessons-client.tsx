"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  BookOpen,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Attachment {
  fileName: string;
  url: string;
  type: string;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  attachments: any;
  createdAt: Date | string;
}

interface LessonsClientProps {
  initialMessages: Message[];
}

const LESSON_CONTENTS: Record<string, { title: string; content: string }> = {
  "msg-seed-1": {
    title: "Database Normalization (1NF, 2NF, 3NF)",
    content:
      "Database Normalization is the process of structuring a relational database in accordance with a series of so-called normal forms in order to reduce data redundancy and improve data integrity. First Normal Form (1NF) requires that data be atomic and have no repeating groups. Second Normal Form (2NF) requires that it is in 1NF and all non-prime attributes are fully functionally dependent on the entire primary key (no partial dependencies). Third Normal Form (3NF) requires that it is in 2NF and there are no transitive dependencies (where a non-prime attribute determines another non-prime attribute). Resolving these dependencies involves splitting fields into dedicated tables.",
  },
  "msg-seed-2": {
    title: "SQL Constraints & Keys",
    content:
      "SQL Constraints are rules enforced on data columns in a table. They prevent invalid data from being entered. Key constraints include PRIMARY KEY, which uniquely identifies records and cannot be NULL, and FOREIGN KEY, which references a PRIMARY KEY in another table to maintain Referential Integrity. Other constraints include UNIQUE (ensuring all values in a column are distinct), NOT NULL, and CHECK (validating values against a boolean expression). Constraints are defined during table creation or altered later.",
  },
  "msg-seed-3": {
    title: "Entity-Relationship (ER) Diagrams",
    content:
      "An Entity-Relationship Diagram (ERD) is a visual representation of different entities within a system and how they relate to each other. Key components include Entities (tables), Attributes (fields), and Relationships (connections). Cardinality describes the numerical relationship between entities, such as One-to-One (1:1), One-to-Many (1:N), and Many-to-Many (M:N). Defining accurate relationships is crucial before physical schema implementation.",
  },
};

// ─── Animation Variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 90,
      damping: 14,
    },
  },
};

export function LessonsClient({ initialMessages }: LessonsClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const getDayLabel = (dateVal: Date | string) => {
    const d = new Date(dateVal);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    
    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTeamsDate = (dateVal: Date | string) => {
    const d = new Date(dateVal);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    
    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    } else {
      return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
    }
  };

  useEffect(() => {
    try {
      const localStr = localStorage.getItem("local_lessons");
      if (localStr) {
        const localLessons = JSON.parse(localStr);
        if (Array.isArray(localLessons)) {
          const all = [...initialMessages, ...localLessons];
          const seenIds = new Set<string>();
          const unique = all.filter((m) => {
            if (seenIds.has(m.id)) return false;
            seenIds.add(m.id);
            return true;
          });
          unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setMessages(unique);
        } else {
          setMessages(initialMessages);
        }
      } else {
        setMessages(initialMessages);
      }
    } catch (err) {
      console.error("Failed to parse local lessons:", err);
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleImport = async (fileName: string) => {
    setImporting((prev) => ({ ...prev, [fileName]: true }));
    try {
      const res = await fetch("/api/lessons/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import");

      toast.success(data.message || "Material successfully imported to Revision Hub!");
    } catch (err: any) {
      toast.error(err.message || "Could not parse attachment.");
    } finally {
      setImporting((prev) => ({ ...prev, [fileName]: false }));
    }
  };

  const handleStartLesson = (msgId: string) => {
    router.push(`/lessons/${msgId}`);
  };

  interface GroupedMessages {
    dayLabel: string;
    messages: Message[];
  }

  const groupedList: GroupedMessages[] = [];
  const labelToGroupMap = new Map<string, GroupedMessages>();

  messages.forEach((msg) => {
    const label = getDayLabel(msg.createdAt);
    let group = labelToGroupMap.get(label);
    if (!group) {
      group = { dayLabel: label, messages: [] };
      labelToGroupMap.set(label, group);
      groupedList.push(group);
    }
    group.messages.push(msg);
  });

  return (
    <div className="flex-1 flex flex-col space-y-8 animate-fade-in pb-12">
      {/* Classroom Banner Cover - Modern Slate/White style */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 100, damping: 15 }}
        className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100/50 px-3 py-1 text-xs font-bold text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Computer Science Channel
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-800">
            Lessons & Lecture Directory
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Browse revision modules sync'd from Microsoft Teams. Click <span className="font-semibold text-slate-700">"Study Lesson"</span> to read syllabus revision notes, practice topics, and ask questions.
          </p>
        </div>
      </motion.div>

      {/* Grouped Messages Feed */}
      <div className="space-y-10">
        {groupedList.map(({ dayLabel, messages }) => (
          <div key={dayLabel} className="space-y-6">
            {/* Simple Date Divider */}
            <div className="relative flex items-center justify-center py-2 select-none">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/80"></div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                {dayLabel}
              </div>
            </div>

            {/* Grid of Lesson Cards */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {messages.map((msg) => {
                const attachmentsList = (msg.attachments as Attachment[]) || [];
                const initials = msg.sender
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const isCustom = (msg as any).isCustomLesson;
                const lessonTitle = (msg as any).title || LESSON_CONTENTS[msg.id]?.title;
                const hasSyllabusContent = isCustom || !!LESSON_CONTENTS[msg.id];

                return (
                  <motion.div 
                    key={msg.id}
                    variants={cardVariants}
                    whileHover={{ scale: 1.02, y: -4, boxShadow: "0 10px 25px rgba(0, 0, 0, 0.04)" }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm transition-all duration-300"
                  >
                    {/* Header Label bar */}
                    <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 border ${
                        hasSyllabusContent 
                          ? "bg-blue-50 border-blue-100/50 text-blue-600" 
                          : "bg-slate-150/50 border-slate-200/50 text-slate-500"
                      }`}>
                        {hasSyllabusContent ? "Revision Unit" : "Announcement"}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {formatTeamsDate(msg.createdAt).split(" at ")[0]}
                      </span>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between min-h-[140px]">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 mb-2" title={lessonTitle || "Syllabus Update"}>
                          {lessonTitle || "Syllabus Update"}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                          {LESSON_CONTENTS[msg.id]?.content || msg.content || "No synopsis available. View details to read full lecture."}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 select-none">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center border border-slate-200">
                            {initials}
                          </div>
                          <span className="font-bold text-slate-700 truncate max-w-[80px]" title={msg.sender}>
                            {msg.sender.split(" ")[0]}
                          </span>
                        </div>

                        {hasSyllabusContent ? (
                          <motion.button
                            onClick={() => handleStartLesson(msg.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring" as const, stiffness: 450, damping: 15 }}
                            className="inline-flex h-8 items-center rounded-full bg-blue-600 text-white px-4 text-xs font-bold hover:bg-blue-700 hover-lift active-press transition-colors shadow-sm hover:shadow cursor-pointer"
                          >
                            Study Lesson
                          </motion.button>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">Bulletin</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
