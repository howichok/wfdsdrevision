"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { Toaster } from "sonner";
import { SessionRegistrar } from "@/components/auth/SessionRegistrar";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionRegistrar />
      {children}

      {/*
       * Toaster — configured for our Zinc/Slate sci-fi dark aesthetic.
       *
       * Key decisions:
       * - position="top-right": keeps toasts away from bottom action bars and
       *   sandbox output panes that live at the bottom of the Studio layout.
       * - expand={false}: prevents the stack from fully expanding on hover,
       *   which would push content under heavy event streams (Recall pipeline
       *   fires multiple events within seconds).
       * - visibleToasts={4}: cap the visible stack to 4 — any 5th+ toast
       *   queues behind the top 4 to avoid overwhelming the UI.
       * - theme="dark": forces the underlying sonner primitives into dark mode
       *   regardless of the OS/user preference (our app is always dark-first).
       * - toastOptions.unstyled + classNames: we intentionally blank out all
       *   sonner default styles because every notification in appToast renders
       *   its own fully custom JSX shell. This makes the wrapper div transparent.
       */}
      <Toaster
        position="top-right"
        expand={false}
        visibleToasts={4}
        theme="dark"
        gap={8}
        toastOptions={{
          unstyled: true,
          classNames: {
            // Zero out the wrapper so our custom ToastShell is the entire visual
            toast: "!bg-transparent !border-0 !shadow-none !p-0 !rounded-none",
            // Preserve default close button styling (it won't show unless closeButton is true)
            closeButton:
              "!bg-zinc-800 !border-zinc-700 !text-zinc-400 hover:!text-zinc-100",
          },
        }}
      />

      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
