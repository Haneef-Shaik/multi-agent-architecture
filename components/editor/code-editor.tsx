"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface CodeEditorProps {
  value: string;
  language?: string;
  path?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  className?: string;
}

// Map file extensions to Monaco language IDs
const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  jsx: "javascriptreact",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  rb: "ruby",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  sql: "sql",
  graphql: "graphql",
  dockerfile: "dockerfile",
  env: "dotenv",
  gitignore: "ignore",
};

function getLanguage(path?: string): string {
  if (!path) return "plaintext";
  const name = path.split("/").pop() ?? "";
  const lowerName = name.toLowerCase();

  if (lowerName === "dockerfile") return "dockerfile";
  if (lowerName.startsWith(".env")) return "dotenv";
  if (lowerName === "makefile") return "makefile";

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANGUAGE[ext] ?? "plaintext";
}

export function CodeEditor({
  value,
  language,
  path,
  readOnly = false,
  onChange,
  onSave,
  className = "",
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const resolvedLanguage = language ?? getLanguage(path);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register Ctrl+S / Cmd+S to save
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const currentValue = editor.getValue();
        onSave?.(currentValue);
      });

      // Focus the editor
      editor.focus();
    },
    [onSave]
  );

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (newValue !== undefined) {
        onChange?.(newValue);
      }
    },
    [onChange]
  );

  return (
    <div className={`h-full w-full ${className}`}>
      <Editor
        height="100%"
        language={resolvedLanguage}
        value={value}
        path={path}
        theme="superagent-dark"
        onChange={handleChange}
        onMount={handleMount}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily:
            '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", monospace',
          fontLigatures: true,
          lineHeight: 20,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          tabSize: 2,
          wordWrap: "on",
          bracketPairColorization: { enabled: true },
          padding: { top: 8, bottom: 8 },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
        beforeMount={(monaco) => {
          // Define custom dark theme
          monaco.editor.defineTheme("superagent-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "comment", foreground: "6a737d", fontStyle: "italic" },
              { token: "keyword", foreground: "c678dd" },
              { token: "string", foreground: "98c379" },
              { token: "number", foreground: "d19a66" },
              { token: "type", foreground: "e5c07b" },
              { token: "function", foreground: "61afef" },
              { token: "variable", foreground: "e06c75" },
            ],
            colors: {
              "editor.background": "#0a0a0a",
              "editor.foreground": "#e0e0e0",
              "editor.lineHighlightBackground": "#111116",
              "editor.selectionBackground": "#3a3a5c55",
              "editorCursor.foreground": "#f0f0f0",
              "editorLineNumber.foreground": "#444",
              "editorLineNumber.activeForeground": "#888",
              "editor.inactiveSelectionBackground": "#2a2a3c33",
              "editorIndentGuide.background": "#1a1a2e",
              "editorIndentGuide.activeBackground": "#333",
              "editorWidget.background": "#111116",
              "editorWidget.border": "#222",
            },
          });
        }}
      />
    </div>
  );
}
