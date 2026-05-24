"use client";
import type { WebContainer } from "@webcontainer/api";

let instance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (!bootPromise) {
    bootPromise = (async () => {
      const { WebContainer } = await import("@webcontainer/api");
      instance = await WebContainer.boot();
      return instance;
    })();
  }
  return bootPromise;
}

export async function runNodeScript(
  code: string,
  filename = "script.mjs"
): Promise<{ stdout: string; exitCode: number }> {
  const wc = await getWebContainer();
  await wc.mount({ [filename]: { file: { contents: code } } });
  const proc = await wc.spawn("node", [filename]);
  const stdout: string[] = [];
  proc.output.pipeTo(
    new WritableStream({ write(d) { stdout.push(d); } })
  );
  const exitCode = await proc.exit;
  return { stdout: stdout.join(""), exitCode };
}
