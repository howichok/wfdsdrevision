import { getWebContainer } from "./runner";

/**
 * Evaluates a Python programming challenge client-side using a Pyodide Web Worker.
 * Enforces a strict 10-second timeout to protect the main browser tab from crashing.
 */
export async function evaluatePythonChallenge(
  userCode: string,
  testSuite: any[],
  starterCode: string = ""
): Promise<{ success: boolean; results: any[] }> {
  return new Promise((resolve, reject) => {
    try {
      // 1. Extract the function name from the starter code (e.g. 'def solution(x):' -> 'solution')
      const match = starterCode.match(/def\s+(\w+)\s*\(/);
      const functionName = match ? match[1] : "solution";

      // 2. Load the Pyodide Web Worker
      const worker = new Worker(
        new URL("./pyodide.worker.ts", import.meta.url),
        { type: "module" }
      );

      // 3. Set a 10-second execution timeout
      const timeoutId = setTimeout(() => {
        worker.terminate();
        reject(new Error("Python execution timed out (10-second limit exceeded). Check for infinite loops."));
      }, 10000);

      // 4. Listen for results back from the worker
      worker.onmessage = (event: MessageEvent) => {
        clearTimeout(timeoutId);
        worker.terminate();

        const response = event.data;
        if (response.type === "success") {
          resolve({
            success: response.success,
            results: response.results,
          });
        } else {
          reject(new Error(response.error || "Unknown Pyodide evaluation error"));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeoutId);
        worker.terminate();
        reject(new Error(err.message || "Pyodide worker execution crashed."));
      };

      // 5. Trigger evaluation
      worker.postMessage({
        code: userCode,
        testSuite,
        functionName,
      });
    } catch (err: any) {
      reject(new Error(`Failed to initialize Pyodide sandbox: ${err.message || err}`));
    }
  });
}

/**
 * Evaluates a JavaScript/Node challenge client-side inside WebContainers.
 * Writes the user's code and a test runner assertion script, runs them, and captures terminal outputs.
 */
export async function evaluateNodeChallenge(
  userCode: string,
  testSuite: any[],
  starterCode: string = ""
): Promise<{ success: boolean; results: any[] }> {
  // 1. Determine function name to require
  const match = starterCode.match(/function\s+(\w+)\s*\(/) || 
                starterCode.match(/const\s+(\w+)\s*=\s*\(/) || 
                starterCode.match(/let\s+(\w+)\s*=\s*\(/);
  const functionName = match ? match[1] : "solution";

  const container = await getWebContainer();
  const timestamp = Date.now();
  const solutionFileName = `solution_${timestamp}.js`;
  const testFileName = `test_${timestamp}.js`;

  // 2. Generate custom test assertion file that outputs results as structured JSON
  const testScript = `
const fs = require('fs');

let userExport;
try {
  userExport = require('./${solutionFileName}');
} catch (e) {
  console.log(JSON.stringify({
    type: 'init_error',
    error: e.message || String(e)
  }));
  process.exit(1);
}

const testSuite = ${JSON.stringify(testSuite)};
const results = [];

for (let i = 0; i < testSuite.length; i++) {
  const tc = testSuite[i];
  try {
    const args = JSON.parse(tc.input);
    const expected = JSON.parse(tc.expectedOutput);
    
    // Support module.exports = function or module.exports = { function }
    const fn = typeof userExport === 'function' ? userExport : userExport['${functionName}'];
    if (!fn) {
      throw new Error("Function '${functionName}' not found in solution exports.");
    }
    
    const actual = fn(...args);
    const success = JSON.stringify(actual) === JSON.stringify(expected);
    
    results.push({
      input: tc.input,
      expected: tc.expectedOutput,
      actual: JSON.stringify(actual),
      success
    });
  } catch (err) {
    results.push({
      input: tc.input,
      expected: tc.expectedOutput,
      actual: 'Error: ' + (err.message || String(err)),
      success: false
    });
  }
}

console.log(JSON.stringify({
  type: 'results',
  results,
  success: results.every(r => r.success)
}));

if (results.every(r => r.success)) {
  process.exit(0);
} else {
  process.exit(1);
}
`;

  try {
    // 3. Write files into WebContainer's virtual file system
    // We append a module export statement so require() loads the user's function
    const modifiedUserCode = userCode + `\nmodule.exports = ${functionName};\n`;
    await container.fs.writeFile(solutionFileName, modifiedUserCode);
    await container.fs.writeFile(testFileName, testScript);

    // 4. Spawn the node command to run our tests
    const process = await container.spawn("node", [testFileName]);

    let output = "";
    const reader = process.output.getReader();

    // Stream reader loop to collect all console stdout/stderr lines
    const readPromise = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          output += value;
        }
      } catch (err) {
        console.error("[Evaluator WebContainer] Output stream read error:", err);
      }
    })();

    // 5. Enforce 10-second timeout
    const exitCodePromise = process.exit;
    const timeoutPromise = new Promise<number>((_, reject) => {
      setTimeout(() => {
        try {
          process.kill();
        } catch (e) {
          // ignore
        }
        reject(new Error("JavaScript execution timed out (10-second limit exceeded). Check for infinite loops."));
      }, 10000);
    });

    try {
      await Promise.race([exitCodePromise, timeoutPromise]);
    } finally {
      reader.releaseLock();
    }

    await readPromise;

    // Clean up temporary files from virtual file system
    try {
      await container.fs.rm(solutionFileName);
      await container.fs.rm(testFileName);
    } catch (e) {
      // ignore
    }

    // 6. Extract and parse structured JSON test result from output stream
    const lines = output.split("\n");
    let testResult: any = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "results" || parsed.type === "init_error") {
            testResult = parsed;
            break;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (!testResult) {
      throw new Error(`Test runner output parse failed. Raw console output:\n${output}`);
    }

    if (testResult.type === "init_error") {
      throw new Error(testResult.error || "Syntax / import initialization error in user code.");
    }

    return {
      success: testResult.success,
      results: testResult.results,
    };

  } catch (err: any) {
    // Graceful cleanup fallback in case of errors
    try {
      await container.fs.rm(solutionFileName);
      await container.fs.rm(testFileName);
    } catch (e) {
      // ignore
    }
    throw err;
  }
}
