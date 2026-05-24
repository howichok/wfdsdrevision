import { WebContainer } from "@webcontainer/api";

// WebContainer singleton references
let webcontainerInstance: WebContainer | null = null;
let webcontainerPromise: Promise<WebContainer> | null = null;

/**
 * Lazily boots the StackBlitz WebContainer instance in the browser.
 */
export async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;
  if (webcontainerPromise) return webcontainerPromise;

  if (typeof window === "undefined") {
    throw new Error("WebContainer can only run in a browser environment");
  }

  console.log("[Runner] Initializing StackBlitz WebContainer...");
  webcontainerPromise = WebContainer.boot().then((instance) => {
    webcontainerInstance = instance;
    console.log("[Runner] StackBlitz WebContainer successfully booted.");
    return instance;
  });

  return webcontainerPromise;
}

/**
 * Executes standard Node.js / JavaScript inside the WebContainer sandbox.
 * Timeout is enforced at 10 seconds to prevent infinite loops from hanging the browser.
 */
export async function runNodeCode(code: string): Promise<string> {
  try {
    const container = await getWebContainer();
    const fileName = `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.js`;

    // 1. Write the code block contents to the virtual filesystem
    await container.fs.writeFile(fileName, code);

    // 2. Spawn node process
    const process = await container.spawn("node", [fileName]);

    let output = "";
    const reader = process.output.getReader();

    // Read the output stream asynchronously
    const readPromise = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          output += value;
        }
      } catch (err) {
        console.error("[Runner WebContainer] Output stream read error:", err);
      }
    })();

    // 3. Enforce execution timeout
    const exitCodePromise = process.exit;
    const timeoutPromise = new Promise<number>((_, reject) => {
      setTimeout(() => {
        try {
          process.kill();
        } catch (e) {
          // ignore
        }
        reject(new Error("Execution timed out (10 seconds)"));
      }, 10000);
    });

    try {
      await Promise.race([exitCodePromise, timeoutPromise]);
    } finally {
      reader.releaseLock();
    }

    // Await reading standard streams
    await readPromise;

    // Clean up temporary script file
    try {
      await container.fs.rm(fileName);
    } catch (e) {
      // Ignore cleanup error
    }

    return output || "Code executed successfully with no output.";
  } catch (err: any) {
    return `Node.js Error: ${err.message || err}`;
  }
}

// Pyodide singleton references
let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;
let pythonStdoutCollector = "";

/**
 * Lazily loads the Pyodide WASM environment from jsDelivr CDN.
 */
export async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  if (typeof window === "undefined") {
    throw new Error("Pyodide can only run in a browser environment");
  }

  pyodideLoadingPromise = (async () => {
    // 1. Check if Pyodide script is already loaded on document window
    if (!(window as any).loadPyodide) {
      console.log("[Runner] Injecting Pyodide script tag from CDN...");
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide script from jsDelivr CDN. Check network connection."));
        document.head.appendChild(script);
      });
    }

    console.log("[Runner] Bootstrapping Pyodide WebAssembly engine...");
    const instance = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/",
      stdout: (text: string) => {
        pythonStdoutCollector += text + "\n";
      },
      stderr: (text: string) => {
        pythonStdoutCollector += text + "\n";
      },
    });

    pyodideInstance = instance;
    console.log("[Runner] Pyodide WASM environment loaded successfully.");
    return instance;
  })();

  return pyodideLoadingPromise;
}

/**
 * Executes Python scripts in the Pyodide WebAssembly container.
 */
export async function runPythonCode(code: string): Promise<string> {
  pythonStdoutCollector = "";
  try {
    const pyodide = await getPyodide();

    // Execute Python script asynchronously
    await pyodide.runPythonAsync(code);

    return pythonStdoutCollector || "Code executed successfully with no output.";
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    return `${pythonStdoutCollector ? pythonStdoutCollector + "\n" : ""}Python Error: ${errorMsg}`;
  }
}
