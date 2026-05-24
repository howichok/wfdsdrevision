// Web Worker to execute Pyodide (Python WASM) executions in a background thread.
// This prevents infinite loops in user code from locking up the browser's UI thread.

declare const loadPyodide: any;

let pyodideInstance: any = null;

async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;

  // Import Pyodide script inside the worker scope
  // @ts-ignore
  importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

  pyodideInstance = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/",
  });
  return pyodideInstance;
}

self.onmessage = async (event: MessageEvent) => {
  const { code, testSuite, functionName } = event.data;

  try {
    const py = await getPyodide();

    // 1. Run the user's code to register their function definitions in the global scope
    await py.runPythonAsync(code);

    const results = [];

    // 2. Iterate through each test case in the test suite
    for (let i = 0; i < testSuite.length; i++) {
      const tc = testSuite[i];
      const inputStr = tc.input; // JSON string of arguments, e.g. "[5]"
      const expectedOutputStr = tc.expectedOutput; // JSON string of expected output, e.g. "10"

      // Execute assertion check in Pyodide.
      // We pass the arguments and expected output, then parse them inside Python.
      const testCode = `
import json
try:
    args = json.loads(${JSON.stringify(inputStr)})
    expected = json.loads(${JSON.stringify(expectedOutputStr)})
    
    # Call user's function
    actual = ${functionName}(*args)
    
    # Convert back to JSON for standard structured comparison
    actual_json = json.dumps(actual)
    expected_json = json.dumps(expected)
    success = actual_json == expected_json
    
    __test_res__ = json.dumps({
        "success": success,
        "actual": actual_json,
        "error": None
    })
except Exception as e:
    __test_res__ = json.dumps({
        "success": False,
        "actual": None,
        "error": str(e)
    })
`;
      await py.runPythonAsync(testCode);
      const testResultJson = py.globals.get("__test_res__");
      const testResult = JSON.parse(testResultJson);

      results.push({
        input: inputStr,
        expected: expectedOutputStr,
        actual: testResult.error ? `Error: ${testResult.error}` : testResult.actual,
        success: testResult.success,
      });
    }

    const overallSuccess = results.every((r) => r.success);
    self.postMessage({
      type: "success",
      results,
      success: overallSuccess,
    });
  } catch (err: any) {
    self.postMessage({
      type: "error",
      error: err.message || String(err),
    });
  }
};
