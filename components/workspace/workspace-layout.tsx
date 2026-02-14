"use client";

import { useState, useCallback, type ReactNode } from "react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import {
  MessageSquare,
  Code,
  Eye,
  Terminal,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTree, type FileTreeItem } from "@/components/editor/file-tree";
import { FileTabs } from "@/components/editor/file-tabs";
import { CodeEditor } from "@/components/editor/code-editor";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { useSandbox } from "@/hooks/use-sandbox";

type WorkspaceMode = "simple" | "developer";

interface WorkspaceLayoutProps {
  chatPanel: ReactNode;
  agentActivityPanel?: ReactNode;
  sandboxId: string | null;
  projectId: string;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;
}

export function WorkspaceLayout({
  chatPanel,
  agentActivityPanel,
  sandboxId,
  projectId,
}: WorkspaceLayoutProps) {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [activeRightPanel, setActiveRightPanel] = useState<
    "preview" | "terminal" | "activity"
  >("preview");
  const [showSidebar, setShowSidebar] = useState(true);

  // File management state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>();

  // Sandbox data
  const {
    sandbox,
    fileTree,
    readFile,
    writeFile,
    isWriting,
  } = useSandbox(sandboxId);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  // Open a file from the file tree
  const handleFileSelect = useCallback(
    async (path: string) => {
      // Check if already open
      const existing = openFiles.find((f) => f.path === path);
      if (existing) {
        setActiveFilePath(path);
        return;
      }

      try {
        const content = await readFile(path);
        const name = path.split("/").pop() ?? path;
        setOpenFiles((prev) => [
          ...prev,
          { path, name, content, originalContent: content },
        ]);
        setActiveFilePath(path);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [openFiles, readFile]
  );

  // Close a file tab
  const handleFileClose = useCallback(
    (path: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.path !== path));
      if (activeFilePath === path) {
        setActiveFilePath(openFiles.find((f) => f.path !== path)?.path);
      }
    },
    [activeFilePath, openFiles]
  );

  // Update file content in memory
  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeFilePath) return;
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === activeFilePath ? { ...f, content: value } : f
        )
      );
    },
    [activeFilePath]
  );

  // Save file to sandbox
  const handleSave = useCallback(
    async (value: string) => {
      if (!activeFilePath) return;
      try {
        await writeFile({ path: activeFilePath, content: value });
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === activeFilePath
              ? { ...f, originalContent: value, content: value }
              : f
          )
        );
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    },
    [activeFilePath, writeFile]
  );

  const previewPorts = sandbox?.ports ?? [];
  const tabs = openFiles.map((f) => ({
    path: f.path,
    name: f.name,
    modified: f.content !== f.originalContent,
  }));

  // --- Simple Mode ---
  if (mode === "simple") {
    return (
      <div className="h-full flex flex-col">
        <WorkspaceToolbar mode={mode} setMode={setMode} />
        <div className="flex-1 min-h-0">
          <Allotment>
            <Allotment.Pane minSize={300}>
              <Allotment vertical>
                <Allotment.Pane minSize={200}>{chatPanel}</Allotment.Pane>
                {agentActivityPanel && (
                  <Allotment.Pane minSize={120} preferredSize={240}>
                    {agentActivityPanel}
                  </Allotment.Pane>
                )}
              </Allotment>
            </Allotment.Pane>
            <Allotment.Pane minSize={300}>
              {sandboxId && previewPorts.length > 0 ? (
                <PreviewPanel
                  sandboxId={sandboxId}
                  ports={previewPorts}
                />
              ) : (
                <EmptyState
                  icon={<Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />}
                  message="Preview will appear once the agent starts building"
                />
              )}
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    );
  }

  // --- Developer Mode ---
  return (
    <div className="h-full flex flex-col">
      <WorkspaceToolbar
        mode={mode}
        setMode={setMode}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        activeRightPanel={activeRightPanel}
        setActiveRightPanel={setActiveRightPanel}
      />
      <div className="flex-1 min-h-0">
        <Allotment>
          {/* Left sidebar: file tree + mini chat */}
          {showSidebar && (
            <Allotment.Pane
              minSize={180}
              maxSize={400}
              preferredSize={240}
            >
              <Allotment vertical>
                {/* File tree */}
                <Allotment.Pane minSize={100}>
                  <div className="h-full flex flex-col bg-[var(--panel)]">
                    <div className="px-3 py-2 text-xs text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--border)]">
                      Explorer
                    </div>
                    <div className="flex-1 overflow-auto">
                      <FileTree
                        items={fileTree}
                        selectedPath={activeFilePath}
                        onSelect={handleFileSelect}
                      />
                    </div>
                  </div>
                </Allotment.Pane>
                {/* Mini chat */}
                <Allotment.Pane minSize={120} preferredSize={280}>
                  <div className="h-full border-t border-[var(--border)]">
                    {chatPanel}
                  </div>
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
          )}

          {/* Center: code editor */}
          <Allotment.Pane minSize={300}>
            <div className="h-full flex flex-col">
              <FileTabs
                tabs={tabs}
                activeTab={activeFilePath}
                onSelect={setActiveFilePath}
                onClose={handleFileClose}
              />
              <div className="flex-1 min-h-0">
                {activeFile ? (
                  <CodeEditor
                    value={activeFile.content}
                    path={activeFile.path}
                    onChange={handleEditorChange}
                    onSave={handleSave}
                  />
                ) : (
                  <EmptyState
                    icon={
                      <Code className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    }
                    message="Select a file from the explorer to edit"
                  />
                )}
              </div>
            </div>
          </Allotment.Pane>

          {/* Right: preview / terminal / activity */}
          <Allotment.Pane minSize={250} preferredSize="40%">
            {activeRightPanel === "preview" ? (
              sandboxId && previewPorts.length > 0 ? (
                <PreviewPanel
                  sandboxId={sandboxId}
                  ports={previewPorts}
                />
              ) : (
                <EmptyState
                  icon={<Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />}
                  message="Start a dev server to see the preview"
                />
              )
            ) : activeRightPanel === "activity" ? (
              agentActivityPanel ?? (
                <EmptyState
                  icon={<Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />}
                  message="Agent activity will appear during execution"
                />
              )
            ) : sandboxId ? (
              <TerminalPanel sandboxId={sandboxId} />
            ) : (
              <EmptyState
                icon={
                  <Terminal className="h-8 w-8 mx-auto mb-2 opacity-30" />
                }
                message="Terminal available when sandbox is active"
              />
            )}
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}

// --- Sub-components ---

function WorkspaceToolbar({
  mode,
  setMode,
  showSidebar,
  setShowSidebar,
  activeRightPanel,
  setActiveRightPanel,
}: {
  mode: WorkspaceMode;
  setMode: (m: WorkspaceMode) => void;
  showSidebar?: boolean;
  setShowSidebar?: (v: boolean) => void;
  activeRightPanel?: "preview" | "terminal" | "activity";
  setActiveRightPanel?: (v: "preview" | "terminal" | "activity") => void;
}) {
  return (
    <div className="h-10 border-b border-[var(--border)] flex items-center justify-between px-3 shrink-0 bg-[var(--panel)]">
      <div className="flex items-center gap-1">
        {mode === "developer" && setShowSidebar && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() =>
            setMode(mode === "simple" ? "developer" : "simple")
          }
        >
          {mode === "simple" ? (
            <>
              <Code className="h-3.5 w-3.5" />
              Developer Mode
            </>
          ) : (
            <>
              <MessageSquare className="h-3.5 w-3.5" />
              Simple Mode
            </>
          )}
        </Button>
      </div>
      {mode === "developer" && setActiveRightPanel && (
        <div className="flex items-center gap-0.5">
          <Button
            variant={activeRightPanel === "preview" ? "outline" : "ghost"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setActiveRightPanel("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant={activeRightPanel === "terminal" ? "outline" : "ghost"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setActiveRightPanel("terminal")}
          >
            <Terminal className="h-3.5 w-3.5" />
            Terminal
          </Button>
          <Button
            variant={activeRightPanel === "activity" ? "outline" : "ghost"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setActiveRightPanel("activity")}
          >
            <Activity className="h-3.5 w-3.5" />
            Agents
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: ReactNode;
  message: string;
}) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">
      <div className="text-center">
        {icon}
        <p>{message}</p>
      </div>
    </div>
  );
}
