"use client";

import { useEffect, useRef } from "react";
import { useAppSession } from "@/lib/auth/auth-client";

export function SessionRegistrar() {
  const { data: session } = useAppSession();
  const registered = useRef(false);

  useEffect(() => {
    if (!session?.user || registered.current) return;
    registered.current = true;
    fetch("/api/sessions", { method: "POST" }).catch(() => {
      registered.current = false;
    });
  }, [session?.user?.id]);

  return null;
}
