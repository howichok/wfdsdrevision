/**
 * WebContainer workspace template utilities.
 *
 * Converts flat path→contents maps into the hierarchical FileSystemTree structure
 * that @webcontainer/api's mount() method expects, and provides pre-wired
 * project skeletons for Node.js and TypeScript workspaces.
 */
import type { FileSystemTree } from "@webcontainer/api";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Flat map of relative file paths (e.g. "src/index.ts") to their string contents. */
export type WorkspaceFiles = Record<string, string>;

/** A single inline comment produced by the AI code-review engine. */
export interface ReviewComment {
  filePath: string;
  lineNumber: number;
  type: "error" | "warning" | "optimization";
  comment: string;
}

// ─── FileSystemTree builder ───────────────────────────────────────────────────

/**
 * Converts a flat WorkspaceFiles map into the hierarchical FileSystemTree
 * that WebContainer's `mount()` expects.
 *
 * Handles arbitrarily nested paths by creating intermediate DirectoryNode
 * entries on demand.  Existing directory nodes are never clobbered — sibling
 * files are merged into the same directory object.
 *
 * @example
 * filesToTree({ "src/index.ts": "…", "package.json": "…" })
 * // → { src: { directory: { "index.ts": { file: { contents: "…" } } } },
 * //     "package.json": { file: { contents: "…" } } }
 */
export function filesToTree(files: WorkspaceFiles): FileSystemTree {
  const root: FileSystemTree = {};

  for (const [rawPath, contents] of Object.entries(files)) {
    const segments = rawPath.split("/").filter(Boolean);
    let cursor: FileSystemTree = root;

    // Walk / create intermediate directories
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!(seg in cursor)) {
        cursor[seg] = { directory: {} };
      }
      const node = cursor[seg];
      if (!("directory" in node)) {
        // Path collision: a file exists where we expected a directory — skip
        break;
      }
      cursor = node.directory;
    }

    // Place the leaf file
    const fileName = segments[segments.length - 1];
    if (fileName) {
      cursor[fileName] = { file: { contents } };
    }
  }

  return root;
}

// ─── Template generators ──────────────────────────────────────────────────────

/**
 * Generates a minimal package.json for a sandboxed Node.js project.
 *
 * The `test` script intentionally falls back to `node src/index.js` so the
 * sandbox always produces terminal output even when no test framework is
 * installed.
 */
export function makePackageJson(
  name: string,
  opts: {
    type?: "module" | "commonjs";
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {}
): string {
  const pkg = {
    name,
    version: "0.0.1",
    private: true,
    type: opts.type ?? "module",
    scripts: {
      start: "node src/index.js",
      test: "node src/index.js",
      ...opts.scripts,
    },
    dependencies: opts.dependencies ?? {},
    devDependencies: opts.devDependencies ?? {},
  };
  return JSON.stringify(pkg, null, 2);
}

/**
 * Generates a modern TypeScript compiler configuration suitable for a
 * WebContainer sandbox (no composite build, ES2022 output, bundler module
 * resolution so relative imports work without extension gymnastics).
 */
export function makeTsConfig(): string {
  const cfg = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      outDir: "dist",
      rootDir: "src",
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
  return JSON.stringify(cfg, null, 2);
}

// ─── Project skeletons ────────────────────────────────────────────────────────

/**
 * Plain Node.js (ESM) starter — no build step, no test framework.
 * `npm test` executes the entry point directly.
 */
export function nodeStarterTemplate(projectName: string): WorkspaceFiles {
  return {
    "package.json": makePackageJson(projectName),
    "src/index.js": [
      `// ${projectName} — entry point`,
      "",
      "/**",
      " * Returns a personalised greeting string.",
      " * @param {string} name",
      " * @returns {string}",
      " */",
      "function greet(name) {",
      "  if (!name || typeof name !== 'string') {",
      "    throw new TypeError('name must be a non-empty string');",
      "  }",
      "  return `Hello, ${name}!`;",
      "}",
      "",
      "console.log(greet('World'));",
      "console.log(greet('WebContainer'));",
    ].join("\n"),
    "README.md": [
      `# ${projectName}`,
      "",
      "A sandboxed Node.js (ESM) workspace.",
      "",
      "## Scripts",
      "| Command | Description |",
      "|---------|-------------|",
      "| `npm start` | Run the entry point |",
      "| `npm test`  | Alias for `npm start` |",
    ].join("\n"),
  };
}

/**
 * TypeScript workspace with vitest unit tests pre-wired.
 * `npm test` runs `vitest run` after `npm install` fetches the dev dependency.
 */
export function tsTestTemplate(projectName: string): WorkspaceFiles {
  return {
    "package.json": makePackageJson(projectName, {
      scripts: {
        start: "node dist/index.js",
        build: "tsc",
        test: "vitest run --reporter=verbose",
      },
      devDependencies: {
        typescript: "^5.4.5",
        vitest: "^1.6.0",
      },
    }),
    "tsconfig.json": makeTsConfig(),
    "src/index.ts": [
      `// ${projectName} — math utilities`,
      "",
      "export function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "export function subtract(a: number, b: number): number {",
      "  return a - b;",
      "}",
      "",
      "export function multiply(a: number, b: number): number {",
      "  return a * b;",
      "}",
      "",
      "export function divide(a: number, b: number): number {",
      "  if (b === 0) throw new RangeError('Division by zero');",
      "  return a / b;",
      "}",
    ].join("\n"),
    "src/index.test.ts": [
      'import { describe, it, expect } from "vitest";',
      'import { add, subtract, multiply, divide } from "./index.js";',
      "",
      'describe("Math utilities", () => {',
      '  it("add: sums two integers", () => {',
      "    expect(add(2, 3)).toBe(5);",
      "  });",
      "",
      '  it("subtract: returns the difference", () => {',
      "    expect(subtract(10, 4)).toBe(6);",
      "  });",
      "",
      '  it("multiply: returns the product", () => {',
      "    expect(multiply(3, 4)).toBe(12);",
      "  });",
      "",
      '  it("divide: returns the quotient", () => {',
      "    expect(divide(10, 2)).toBe(5);",
      "  });",
      "",
      '  it("divide: throws on division by zero", () => {',
      "    expect(() => divide(5, 0)).toThrow(RangeError);",
      "  });",
      "});",
    ].join("\n"),
    "README.md": [
      `# ${projectName}`,
      "",
      "TypeScript workspace with vitest unit tests.",
      "",
      "## Scripts",
      "| Command | Description |",
      "|---------|-------------|",
      "| `npm test`  | Run vitest unit tests |",
      "| `npm run build` | Compile TypeScript |",
    ].join("\n"),
  };
}
