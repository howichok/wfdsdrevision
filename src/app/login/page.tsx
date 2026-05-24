"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp, useAppSession } from "@/lib/auth/auth-client";
import { toast } from "sonner";
import {
  GraduationCap,
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
  Globe,
  ArrowRight,
  Route,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const showSkipLogin =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_ENABLE_LOGIN_SKIP === "true" ||
  process.env.NEXT_PUBLIC_OFFLINE_MODE === "true";

function authErrorMessage(
  error: { message?: string; status?: number; code?: string } | null | undefined,
  fallback: string
): string {
  if (!error) return fallback;
  const detail = error.message?.trim();
  if (detail) return detail;
  if (error.code) return `${fallback} (${error.code})`;
  if (error.status) return `${fallback} (HTTP ${error.status})`;
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useAppSession();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (session) router.push("/");
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      if (activeTab === "signin") {
        const { error } = await signIn.email({ email, password });
        if (error) throw new Error(authErrorMessage(error, "Failed to sign in"));
        toast.success("Welcome back!");
        router.push("/");
      } else {
        if (!name) {
          toast.error("Please enter your name.");
          setLoading(false);
          return;
        }
        const { error } = await signUp.email({ email, password, name });
        if (error) throw new Error(authErrorMessage(error, "Failed to create account"));
        toast.success("Account created!");
        router.push("/");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn.social({ provider: "google" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google Sign-In failed.");
    }
  };

  const handleSkipLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/guest-skip", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; offline?: boolean };
      if (!res.ok) throw new Error(data.error || "Guest login unavailable");
      toast.success(data.offline ? "Continuing offline…" : "Continuing as guest…");
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Skip login failed.");
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center zenith-mesh">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] zenith-lines zenith-flow">
      <div className="hidden lg:flex flex-col justify-between px-12 py-10 border-r border-border/45">
        <div>
          <Link href="/welcome" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-bold">ReviseAI</span>
          </Link>
        </div>
        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 border border-border/60 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Unified Canvas
          </div>
          <h1 className="font-heading text-4xl font-bold leading-tight">
            One continuous workspace for <span className="text-primary">study flow.</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Pathline progress, AI coaching, and practice loops update from one context.
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[
              { icon: Route, text: "Inline curriculum map with live mastery signals" },
              { icon: Sparkles, text: "Context-aware AI notes per selected topic" },
              { icon: GraduationCap, text: "Exam-ready actions without jumping views" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 border-b border-border/45 pb-3 last:border-b-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/60 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground/70">
          © ReviseAI · Built for focused revision
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <Link href="/welcome" className="inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-heading text-lg font-bold">ReviseAI</span>
            </Link>
          </div>

          <div className="space-y-5 border-y border-border/50 py-6">
            <div className="space-y-1">
              <h2 className="font-heading text-2xl font-bold">Welcome back</h2>
              <p className="text-sm text-muted-foreground">
                Sign in to continue your revision path.
              </p>
            </div>

            <div className="flex border-b border-border/60 pb-1">
              {(["signin", "signup"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 rounded-md py-2 text-xs font-semibold transition-all uppercase tracking-wide",
                    activeTab === tab
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                >
                  {tab === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Your name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Chen"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="smooth-input w-full rounded-md border border-input/70 bg-transparent py-2.5 pl-10 pr-4 text-sm zenith-field"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="smooth-input w-full rounded-md border border-input/70 bg-transparent py-2.5 pl-10 pr-4 text-sm zenith-field"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="smooth-input w-full rounded-md border border-input/70 bg-transparent py-2.5 pl-10 pr-4 text-sm zenith-field"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activeTab === "signin" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="absolute bg-background px-3 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Or
              </span>
              <div className="w-full border-t border-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full h-10 rounded-md border border-border bg-background/70 hover:bg-accent text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Globe className="h-4 w-4 text-primary" />
              Google account
            </button>

            {showSkipLogin && (
              <button
                type="button"
                onClick={handleSkipLogin}
                disabled={loading}
                className="w-full h-10 rounded-md border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Skip for now
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/welcome" className="text-primary hover:underline font-medium">
              ← Back to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
