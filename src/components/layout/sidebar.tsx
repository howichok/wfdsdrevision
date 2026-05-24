"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CloudLightning,
  Menu,
  X,
  GraduationCap,
  MessagesSquare,
  Network,
  Route,
  Plus,
  Shield,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppSession, signOut } from "@/lib/auth/auth-client";
import type { UserRole } from "@/lib/db/schema";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard, roles: ["SA", "T", "S", "SU"] as UserRole[] },
  { href: "/lessons", label: "Lessons", icon: MessagesSquare, roles: ["SA", "T", "S", "SU"] as UserRole[] },
  { href: "/exam-prep", label: "Exam Prep", icon: GraduationCap, roles: ["SA", "T", "S", "SU"] as UserRole[] },
  { href: "/revision", label: "Revision", icon: BookOpen, roles: ["SA", "T", "S", "SU"] as UserRole[] },
  { href: "/revision/pathline", label: "Pathline", icon: Route, roles: ["SA", "T", "S", "SU"] as UserRole[] },
  { href: "/canvas", label: "Checklist", icon: Network, roles: ["SA", "T", "S", "SU"] as UserRole[] },
];

function getRole(user: { role?: string } | undefined): UserRole {
  const r = user?.role;
  if (r === "SA" || r === "T" || r === "S" || r === "SU") return r;
  return "SU";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useAppSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = getRole(session?.user as { role?: string });
  const displayName = session?.user?.name || session?.user?.email || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const showTeamsSync = role === "SA" || role === "T";
  const showCreateLesson = role === "SA" || role === "T";
  const showAdminSessions = role === "SA";

  const handleSignOut = async () => {
    await fetch("/api/auth/guest-skip", { method: "DELETE" }).catch(() => {});
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-heading text-lg font-bold text-foreground hidden sm:block">
              ReviseAI
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {visibleNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {showCreateLesson && (
            <Link
              href="/lessons/create"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 hover:bg-accent/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              Create
            </Link>
          )}
          {showTeamsSync && (
            <Link
              href="/teams"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 hover:bg-accent/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              <CloudLightning className="h-3.5 w-3.5 text-primary" />
              Teams
            </Link>
          )}
          {showAdminSessions && (
            <Link
              href="/admin/sessions"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 hover:bg-accent/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              <Shield className="h-3.5 w-3.5 text-primary" />
              Admin
            </Link>
          )}
          <Link
            href="/settings/security"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            title="Security"
          >
            <Shield className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 border-l border-border/50 pl-3 ml-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
              {initial}
            </div>
            <div className="hidden lg:flex flex-col max-w-[120px]">
              <span className="text-xs font-semibold text-foreground truncate">{displayName}</span>
              <span className="text-[10px] text-muted-foreground">{role}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-accent/60"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/90 px-3 py-3 space-y-1">
          {visibleNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/60"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="border-t border-border/50 pt-3 mt-2 space-y-2">
            {showCreateLesson && (
              <Link href="/lessons/create" onClick={() => setMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm font-medium">
                Create lesson
              </Link>
            )}
            <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
