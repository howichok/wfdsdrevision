"use client";

import { useEffect, useRef, useCallback } from "react";

export function useIngestWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("./ingest.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const parseFile = useCallback(
    (fileType: "pdf" | "docx", arrayBuffer: ArrayBuffer): Promise<{ text: string; pageCount?: number }> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Ingest worker is not initialized"));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          const response = event.data;
          if (response.type === "success") {
            resolve({ text: response.text, pageCount: response.pageCount });
          } else if (response.type === "error") {
            reject(new Error(response.error));
          }
          cleanup();
        };

        const handleError = (event: ErrorEvent) => {
          reject(new Error(event.message || "Unknown error occurred inside the web worker"));
          cleanup();
        };

        const cleanup = () => {
          worker.removeEventListener("message", handleMessage);
          worker.removeEventListener("error", handleError);
        };

        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", handleError);

        // Transfer the ArrayBuffer to prevent copying overhead
        worker.postMessage({ fileType, arrayBuffer }, [arrayBuffer]);
      });
    },
    []
  );

  return { parseFile };
}
