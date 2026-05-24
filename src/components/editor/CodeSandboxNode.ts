import CodeBlock from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeSandboxComponent } from "./CodeSandboxComponent";

/**
 * Custom Tiptap Node extension that extends the standard CodeBlock extension.
 * Replaces the default flat text display with our React-based CodeSandboxComponent,
 * allowing inline code execution of Node.js and Python inside the editor document.
 */
export const CodeSandboxNode = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeSandboxComponent);
  },
});
