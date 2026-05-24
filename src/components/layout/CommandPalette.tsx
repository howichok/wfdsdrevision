"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  GraduationCap,
  BookOpen,
  Network,
  CloudLightning,
  Layers,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore } from "@/store/app.store";

const NAV_COMMANDS = [
  { id: "dashboard", label: "Home", href: "/", icon: LayoutDashboard, shortcut: "H" },
  { id: "lessons", label: "Lessons", href: "/lessons", icon: MessagesSquare, shortcut: "L" },
  { id: "exam-prep", label: "Exam Preparation", href: "/exam-prep", icon: GraduationCap, shortcut: "E" },
  { id: "revision", label: "Revision", href: "/revision", icon: BookOpen, shortcut: "R" },
  { id: "canvas", label: "Knowledge Graph", href: "/canvas", icon: Network, shortcut: "G" },
  { id: "teams", label: "Teams Sync Settings", href: "/teams", icon: CloudLightning },
];

const ACTION_COMMANDS = [
  {
    id: "flashcards",
    label: "Start Flashcard Session",
    href: "/revision",
    icon: Layers,
    shortcut: "F",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, toggleCommandPalette } = useAppStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    },
    [toggleCommandPalette]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const run = (href: string) => {
    toggleCommandPalette();
    router.push(href);
  };

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={toggleCommandPalette}
      title="Command Palette"
      description="Navigate or launch actions across ReviseAI"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Search className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results found.</p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Navigate">
          {NAV_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.id} value={cmd.label} onSelect={() => run(cmd.href)}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                {cmd.label}
                {cmd.shortcut && <CommandShortcut>⌘{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {ACTION_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.id} value={cmd.label} onSelect={() => run(cmd.href)}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                {cmd.label}
                {cmd.shortcut && <CommandShortcut>⌘{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>

      {/* Keyboard shortcut footer */}
      <div className="flex items-center justify-between border-t border-border/30 px-3 py-2.5 bg-muted/20">
        <div className="flex items-center gap-4">
          {[
            { keys: ["↑", "↓"], label: "navigate" },
            { keys: ["↵"], label: "select" },
            { keys: ["Esc"], label: "close" },
          ].map(({ keys, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {keys.map((k) => (
                <kbd
                  key={k}
                  className="inline-flex h-4 min-w-[16px] items-center justify-center rounded border border-border/40 bg-background px-1 font-mono text-[9px]"
                >
                  {k}
                </kbd>
              ))}
              <span>{label}</span>
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <kbd className="inline-flex h-4 items-center justify-center rounded border border-border/40 bg-background px-1 font-mono text-[9px]">
            ⌘K
          </kbd>
          <span>to open</span>
        </span>
      </div>
    </CommandDialog>
  );
}
