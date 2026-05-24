"use client";
import { useEffect, useRef } from "react";
import * as Comlink from "comlink";
import type { ParserWorkerAPI } from "./parser.worker";

export function useParserWorker() {
  const apiRef = useRef<Comlink.Remote<ParserWorkerAPI> | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("./parser.worker.ts", import.meta.url),
      { type: "module" }
    );
    apiRef.current = Comlink.wrap<ParserWorkerAPI>(worker);
    return () => worker.terminate();
  }, []);

  return apiRef;
}
