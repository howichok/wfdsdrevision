"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null;

export async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;
  const { loadPyodide } = await import("pyodide");
  pyodideInstance = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/",
  });
  await pyodideInstance.loadPackage("micropip");
  return pyodideInstance;
}

export async function runPython<T = unknown>(code: string): Promise<T> {
  const py = await getPyodide();
  return py.runPythonAsync(code) as Promise<T>;
}
