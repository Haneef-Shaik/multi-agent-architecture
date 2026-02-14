import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import type { AgentConfig, AgentId } from "@/types/agent";
import { bus } from "./message-bus";
import { skillRegistry } from "@/lib/skills/registry";
import { getProvider } from "@/lib/ai/providers";
import * as fsTools from "@/lib/tools/filesystem";
import * as terminalTools from "@/lib/tools/terminal";
import * as gitTools from "@/lib/tools/git";
import * as pmTools from "@/lib/tools/package-manager";
import * as browserTools from "@/lib/tools/browser";

// --- Tool Schemas ---

const readFileSchema = z.object({
  path: z.string().describe("File path relative to /workspace"),
});

const writeFileSchema = z.object({
  path: z.string().describe("File path relative to /workspace"),
  content: z.string().describe("Complete file content to write"),
});

const editFileSchema = z.object({
  path: z.string().describe("File path relative to /workspace"),
  oldContent: z.string().describe("Exact text to find and replace"),
  newContent: z.string().describe("Replacement text"),
});

const executeCommandSchema = z.object({
  command: z.string().describe("Shell command to execute in /workspace"),
});

const listDirectorySchema = z.object({
  path: z
    .string()
    .describe("Directory path relative to /workspace")
    .default("/workspace"),
  recursive: z
    .boolean()
    .describe("List recursively")
    .default(false),
});

const searchFilesSchema = z.object({
  pattern: z.string().describe("File name glob pattern (e.g., '*.tsx')"),
  path: z
    .string()
    .describe("Directory to search in")
    .default("/workspace"),
});

const grepSchema = z.object({
  pattern: z.string().describe("Search pattern (regex supported)"),
  path: z
    .string()
    .describe("Directory to search in")
    .default("/workspace"),
  include: z
    .string()
    .describe("File glob to filter (e.g., '*.ts')")
    .optional(),
});

const gitCommitSchema = z.object({
  message: z.string().describe("Commit message"),
});

const gitDiffSchema = z.object({
  staged: z.boolean().describe("Show staged changes only").default(false),
  file: z.string().describe("Specific file to diff").optional(),
});

const installPackagesSchema = z.object({
  packages: z.array(z.string()).describe("Package names to install"),
  dev: z.boolean().describe("Install as dev dependency").default(false),
});

const runScriptSchema = z.object({
  script: z.string().describe("Script name from package.json"),
});

const startProcessSchema = z.object({
  command: z
    .string()
    .describe("Command to run as a background process (e.g., 'npm run dev')"),
});

const killProcessSchema = z.object({
  pid: z.string().describe("Process ID to kill"),
});

const moveFileSchema = z.object({
  from: z.string().describe("Source path"),
  to: z.string().describe("Destination path"),
});

const deleteFileSchema = z.object({
  path: z.string().describe("Path to delete"),
});

const gitBranchSchema = z.object({
  name: z.string().describe("Branch name"),
  create: z.boolean().describe("Create new branch").default(false),
});

const screenshotSchema = z.object({
  url: z
    .string()
    .describe("URL to screenshot (e.g., 'http://localhost:3000')"),
  width: z.number().describe("Viewport width").default(1280),
  height: z.number().describe("Viewport height").default(720),
  fullPage: z.boolean().describe("Capture full page").default(false),
});

const getPageContentSchema = z.object({
  url: z.string().describe("URL to fetch page content from"),
});

const checkUrlSchema = z.object({
  url: z.string().describe("URL to health-check"),
});

// --- Tool Factory ---

/**
 * Build the tool set for an agent, bound to a specific container.
 * If no containerId is provided, tools return placeholder messages.
 */
function createAgentTools(containerId?: string) {
  const noSandbox = (name: string) =>
    `[No sandbox available — ${name} requires an active sandbox container]`;

  return {
    readFile: tool({
      description:
        "Read a file from the project workspace. Returns the file contents.",
      inputSchema: readFileSchema,
      execute: async (input: z.infer<typeof readFileSchema>) => {
        if (!containerId) return noSandbox("readFile");
        const r = await fsTools.readFile(containerId, input.path);
        return r.output;
      },
    }),
    writeFile: tool({
      description:
        "Write complete content to a file. Creates parent directories if needed.",
      inputSchema: writeFileSchema,
      execute: async (input: z.infer<typeof writeFileSchema>) => {
        if (!containerId) return noSandbox("writeFile");
        const r = await fsTools.writeFile(containerId, input.path, input.content);
        return r.output;
      },
    }),
    editFile: tool({
      description:
        "Edit a file by finding and replacing a specific string. Use readFile first to see exact content.",
      inputSchema: editFileSchema,
      execute: async (input: z.infer<typeof editFileSchema>) => {
        if (!containerId) return noSandbox("editFile");
        const r = await fsTools.editFile(
          containerId,
          input.path,
          input.oldContent,
          input.newContent
        );
        return r.output;
      },
    }),
    deleteFile: tool({
      description: "Delete a file or directory from the workspace.",
      inputSchema: deleteFileSchema,
      execute: async (input: z.infer<typeof deleteFileSchema>) => {
        if (!containerId) return noSandbox("deleteFile");
        const r = await fsTools.deleteFile(containerId, input.path);
        return r.output;
      },
    }),
    moveFile: tool({
      description: "Move or rename a file.",
      inputSchema: moveFileSchema,
      execute: async (input: z.infer<typeof moveFileSchema>) => {
        if (!containerId) return noSandbox("moveFile");
        const r = await fsTools.moveFile(containerId, input.from, input.to);
        return r.output;
      },
    }),
    listDirectory: tool({
      description:
        "List files and directories. Use recursive=true for a full tree view.",
      inputSchema: listDirectorySchema,
      execute: async (input: z.infer<typeof listDirectorySchema>) => {
        if (!containerId) return noSandbox("listDirectory");
        const r = await fsTools.listDirectory(containerId, input.path, {
          recursive: input.recursive,
        });
        return r.output;
      },
    }),
    searchFiles: tool({
      description:
        "Search for files by name pattern (glob). Returns matching file paths.",
      inputSchema: searchFilesSchema,
      execute: async (input: z.infer<typeof searchFilesSchema>) => {
        if (!containerId) return noSandbox("searchFiles");
        const r = await fsTools.searchFiles(containerId, input.pattern, {
          path: input.path,
        });
        return r.output;
      },
    }),
    grep: tool({
      description:
        "Search file contents with regex. Returns matching lines with file paths and line numbers.",
      inputSchema: grepSchema,
      execute: async (input: z.infer<typeof grepSchema>) => {
        if (!containerId) return noSandbox("grep");
        const r = await fsTools.grepFiles(containerId, input.pattern, {
          path: input.path,
          include: input.include,
        });
        return r.output;
      },
    }),
    executeCommand: tool({
      description:
        "Execute a shell command in the project workspace. Returns stdout, stderr, and exit code.",
      inputSchema: executeCommandSchema,
      execute: async (input: z.infer<typeof executeCommandSchema>) => {
        if (!containerId) return noSandbox("executeCommand");
        const r = await terminalTools.executeCommand(
          containerId,
          input.command
        );
        return r.output;
      },
    }),
    startProcess: tool({
      description:
        "Start a long-running background process (e.g., dev server). Returns the PID.",
      inputSchema: startProcessSchema,
      execute: async (input: z.infer<typeof startProcessSchema>) => {
        if (!containerId) return noSandbox("startProcess");
        const r = await terminalTools.startProcess(
          containerId,
          input.command
        );
        return r.output;
      },
    }),
    killProcess: tool({
      description: "Kill a running process by PID.",
      inputSchema: killProcessSchema,
      execute: async (input: z.infer<typeof killProcessSchema>) => {
        if (!containerId) return noSandbox("killProcess");
        const r = await terminalTools.killProcess(containerId, input.pid);
        return r.output;
      },
    }),
    gitInit: tool({
      description: "Initialize a git repository in the workspace.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!containerId) return noSandbox("gitInit");
        const r = await gitTools.gitInit(containerId);
        return r.output;
      },
    }),
    gitCommit: tool({
      description: "Stage all changes and create a git commit.",
      inputSchema: gitCommitSchema,
      execute: async (input: z.infer<typeof gitCommitSchema>) => {
        if (!containerId) return noSandbox("gitCommit");
        const r = await gitTools.gitCommit(containerId, input.message);
        return r.output;
      },
    }),
    gitDiff: tool({
      description: "Show git diff of current changes.",
      inputSchema: gitDiffSchema,
      execute: async (input: z.infer<typeof gitDiffSchema>) => {
        if (!containerId) return noSandbox("gitDiff");
        const r = await gitTools.gitDiff(containerId, {
          staged: input.staged,
          file: input.file,
        });
        return r.output;
      },
    }),
    gitStatus: tool({
      description: "Show git status (changed, staged, untracked files).",
      inputSchema: z.object({}),
      execute: async () => {
        if (!containerId) return noSandbox("gitStatus");
        const r = await gitTools.gitStatus(containerId);
        return r.output;
      },
    }),
    gitLog: tool({
      description: "Show recent git commits.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!containerId) return noSandbox("gitLog");
        const r = await gitTools.gitLog(containerId);
        return r.output;
      },
    }),
    gitBranch: tool({
      description: "Create or switch git branches.",
      inputSchema: gitBranchSchema,
      execute: async (input: z.infer<typeof gitBranchSchema>) => {
        if (!containerId) return noSandbox("gitBranch");
        const r = await gitTools.gitBranch(containerId, input.name, {
          create: input.create,
        });
        return r.output;
      },
    }),
    installPackages: tool({
      description: "Install npm/bun/pip packages. Auto-detects package manager.",
      inputSchema: installPackagesSchema,
      execute: async (input: z.infer<typeof installPackagesSchema>) => {
        if (!containerId) return noSandbox("installPackages");
        const r = await pmTools.installPackages(containerId, input.packages, {
          dev: input.dev,
        });
        return r.output;
      },
    }),
    runScript: tool({
      description:
        "Run a script defined in package.json (e.g., 'dev', 'build', 'test').",
      inputSchema: runScriptSchema,
      execute: async (input: z.infer<typeof runScriptSchema>) => {
        if (!containerId) return noSandbox("runScript");
        const r = await pmTools.runScript(containerId, input.script);
        return r.output;
      },
    }),
    screenshot: tool({
      description:
        "Take a screenshot of a URL running in the sandbox. Returns a description and base64 image data.",
      inputSchema: screenshotSchema,
      execute: async (input: z.infer<typeof screenshotSchema>) => {
        if (!containerId) return noSandbox("screenshot");
        const r = await browserTools.screenshot(containerId, input.url, {
          width: input.width,
          height: input.height,
          fullPage: input.fullPage,
        });
        return r.output;
      },
    }),
    getPageContent: tool({
      description:
        "Fetch a URL and extract page title, status code, and text content. Useful for verifying what the app renders.",
      inputSchema: getPageContentSchema,
      execute: async (input: z.infer<typeof getPageContentSchema>) => {
        if (!containerId) return noSandbox("getPageContent");
        const r = await browserTools.getPageContent(containerId, input.url);
        return r.output;
      },
    }),
    checkUrl: tool({
      description:
        "Check if a URL is responding (health check). Returns status code and response time.",
      inputSchema: checkUrlSchema,
      execute: async (input: z.infer<typeof checkUrlSchema>) => {
        if (!containerId) return noSandbox("checkUrl");
        const r = await browserTools.checkUrl(containerId, input.url);
        return r.output;
      },
    }),
  };
}

// All tool names for reference
export type AgentToolName = keyof ReturnType<typeof createAgentTools>;

// --- Agent Runner ---

export interface AgentRunOptions {
  agentConfig: AgentConfig;
  messages: ModelMessage[];
  skillNames?: string[];
  taskId: string;
  containerId?: string;
  onText?: (delta: string) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (
    toolName: string,
    result: unknown,
    duration: number
  ) => void;
  signal?: AbortSignal;
}

export async function runAgent(options: AgentRunOptions): Promise<string> {
  const {
    agentConfig,
    messages,
    skillNames = [],
    taskId,
    containerId,
    onText,
    onToolCall,
    onToolResult,
    signal,
  } = options;

  // Load skill bodies for this agent
  const skillBodies: string[] = [];
  for (const skillName of skillNames) {
    const body = await skillRegistry.loadSkillBody(skillName);
    if (body) {
      skillBodies.push(`\n## Skill: ${skillName}\n\n${body}`);
    }
  }

  const systemPrompt = [
    agentConfig.systemPrompt,
    ...skillBodies,
  ].join("\n\n");

  // Build tools bound to the sandbox container
  const allTools = createAgentTools(containerId);

  // Filter tools based on agent config (if specified)
  // If agentConfig.tools is empty, give the agent no tools (e.g., supervisor)
  const tools: Record<string, (typeof allTools)[keyof typeof allTools]> = {};
  if (agentConfig.tools.length > 0) {
    for (const toolName of agentConfig.tools) {
      if (toolName in allTools) {
        tools[toolName] = allTools[toolName as keyof typeof allTools];
      }
    }
  }

  // Emit started event
  bus.emitAgentEvent({
    type: "agent:started",
    agentId: agentConfig.id,
    taskId,
    timestamp: Date.now(),
    payload: { skills: skillNames },
  });

  let fullText = "";

  try {
    const result = streamText({
      model: getProvider(agentConfig.model),
      system: systemPrompt,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen:
        agentConfig.maxToolCalls > 0
          ? stepCountIs(agentConfig.maxToolCalls)
          : undefined,
      abortSignal: signal,
      onStepFinish(event) {
        if (event.toolCalls && event.toolCalls.length > 0) {
          for (const tc of event.toolCalls) {
            const toolName =
              "toolName" in tc
                ? ((tc as Record<string, unknown>).toolName as string)
                : "unknown";
            const args =
              "args" in tc
                ? ((tc as Record<string, unknown>).args as Record<
                    string,
                    unknown
                  >)
                : {};
            onToolCall?.(toolName, args);
            bus.emitAgentEvent({
              type: "agent:tool:call",
              agentId: agentConfig.id,
              taskId,
              timestamp: Date.now(),
              payload: { tool: toolName, args },
            });
          }
        }
        if (event.toolResults && event.toolResults.length > 0) {
          for (const tr of event.toolResults) {
            const toolName =
              "toolName" in tr
                ? ((tr as Record<string, unknown>).toolName as string)
                : "unknown";
            const result =
              "result" in tr
                ? (tr as Record<string, unknown>).result
                : undefined;
            onToolResult?.(toolName, result, 0);
            bus.emitAgentEvent({
              type: "agent:tool:result",
              agentId: agentConfig.id,
              taskId,
              timestamp: Date.now(),
              payload: { tool: toolName, result },
            });
          }
        }
      },
    });

    for await (const chunk of result.textStream) {
      fullText += chunk;
      onText?.(chunk);
      bus.emitAgentEvent({
        type: "agent:text",
        agentId: agentConfig.id,
        taskId,
        timestamp: Date.now(),
        payload: { delta: chunk },
      });
    }

    bus.emitAgentEvent({
      type: "agent:completed",
      agentId: agentConfig.id,
      taskId,
      timestamp: Date.now(),
      payload: { result: fullText },
    });

    return fullText;
  } catch (error) {
    bus.emitAgentEvent({
      type: "agent:error",
      agentId: agentConfig.id,
      taskId,
      timestamp: Date.now(),
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// --- Pre-configured Agent Definitions ---

export const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  supervisor: {
    id: "supervisor",
    name: "Supervisor",
    description:
      "Routes user requests to appropriate agents and manages execution flow",
    systemPrompt: `You are the Supervisor agent. Your role is to understand the user's intent and produce a structured execution plan. You NEVER write code yourself. Instead, you decompose tasks and delegate to specialized agents.

Given the user's message and the list of available skills, produce a JSON execution plan specifying which agents to invoke and which skills each agent should use.

Respond with a JSON object in this format:
{
  "plan": "Brief description of the approach",
  "steps": [
    { "agentId": "planning", "skills": ["architecture-patterns"], "task": "Design the project structure" },
    { "agentId": "coding", "skills": ["frontend-design"], "task": "Implement the components", "dependsOn": ["step-0"] }
  ]
}`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [],
    defaultSkills: [],
    maxToolCalls: 0,
  },
  planning: {
    id: "planning",
    name: "Planning Agent",
    description:
      "Designs project architecture, file structure, and implementation approach",
    systemPrompt: `You are the Planning Agent. Your role is to analyze requirements and produce a detailed implementation plan including:
- Project file structure
- Technology choices and justification
- Component breakdown
- Data model design
- Implementation steps in order

Be specific and actionable. List exact file paths and their purposes.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "listDirectory",
      "searchFiles",
      "grep",
      "gitStatus",
    ],
    defaultSkills: ["architecture-patterns", "software-architecture"],
    maxToolCalls: 10,
  },
  coding: {
    id: "coding",
    name: "Coding Agent",
    description:
      "Writes and edits code files to implement features and fix issues",
    systemPrompt: `You are the Coding Agent. Your role is to write high-quality, production-ready code. Follow the project's existing patterns and conventions. Write clean, typed code with proper error handling.

When creating files:
1. Write complete, working code (no placeholders or TODOs)
2. Follow the framework's best practices
3. Include necessary imports
4. Match the project's code style`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "writeFile",
      "editFile",
      "deleteFile",
      "moveFile",
      "executeCommand",
      "listDirectory",
      "searchFiles",
      "grep",
      "gitInit",
      "gitCommit",
      "gitStatus",
      "installPackages",
      "runScript",
      "startProcess",
      "checkUrl",
      "screenshot",
    ],
    defaultSkills: ["frontend-design"],
    maxToolCalls: 25,
  },
  debugging: {
    id: "debugging",
    name: "Debug Agent",
    description: "Analyzes errors, interprets stack traces, and fixes bugs",
    systemPrompt: `You are the Debug Agent. Your role is to:
1. Analyze error messages and stack traces
2. Identify the root cause
3. Propose and implement fixes
4. Verify the fix resolves the issue

Be methodical. Read the relevant files, understand the context, then fix. Use screenshot/getPageContent to verify visual fixes.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "writeFile",
      "editFile",
      "executeCommand",
      "listDirectory",
      "searchFiles",
      "grep",
      "gitDiff",
      "gitStatus",
      "screenshot",
      "getPageContent",
      "checkUrl",
    ],
    defaultSkills: ["code-review-pro"],
    maxToolCalls: 20,
  },
  testing: {
    id: "testing",
    name: "Testing Agent",
    description: "Writes and runs tests to verify code correctness",
    systemPrompt: `You are the Testing Agent. Write comprehensive tests covering:
- Happy path scenarios
- Edge cases
- Error handling
- Integration between components

Use the project's testing framework. Run tests after writing them and fix failures.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "writeFile",
      "editFile",
      "executeCommand",
      "listDirectory",
      "grep",
      "runScript",
      "installPackages",
    ],
    defaultSkills: ["code-review-pro"],
    maxToolCalls: 15,
  },
  deploy: {
    id: "deploy",
    name: "Deploy Agent",
    description: "Configures deployment, Dockerfiles, and CI/CD pipelines",
    systemPrompt: `You are the Deploy Agent. Your role is to prepare projects for deployment by creating:
- Dockerfiles and docker-compose configurations
- CI/CD pipeline configurations
- Environment variable templates
- Deployment documentation`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "writeFile",
      "executeCommand",
      "listDirectory",
      "searchFiles",
      "gitCommit",
    ],
    defaultSkills: ["architecture-patterns"],
    maxToolCalls: 15,
  },
  design: {
    id: "design",
    name: "Design Agent",
    description:
      "Makes UI/UX decisions, component design, styling, and visual direction",
    systemPrompt: `You are the Design Agent. Your role is to make intentional design decisions:
- Color schemes and typography
- Layout and spacing
- Component structure and composition
- Responsive design
- Accessibility

Avoid generic "AI slop" aesthetics. Make bold, distinctive design choices. Use screenshot to verify visual results.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: ["readFile", "writeFile", "editFile", "listDirectory", "grep", "screenshot", "getPageContent"],
    defaultSkills: [
      "frontend-design",
      "color-palette-extractor",
      "font-pairing-suggester",
    ],
    maxToolCalls: 10,
  },
  database: {
    id: "database",
    name: "Database Agent",
    description: "Designs schemas, writes migrations, and manages database setup",
    systemPrompt: `You are the Database Agent. Design and implement:
- Database schemas (normalized, with proper indexes)
- Migration scripts
- Seed data for development
- Query optimization

Follow database best practices: proper types, constraints, foreign keys, indexes.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "writeFile",
      "executeCommand",
      "listDirectory",
      "installPackages",
    ],
    defaultSkills: ["database-schema-designer"],
    maxToolCalls: 15,
  },
  review: {
    id: "review",
    name: "Review Agent",
    description:
      "Reviews code quality, security, and adherence to best practices",
    systemPrompt: `You are the Review Agent. Perform code reviews focusing on:
1. Security vulnerabilities (OWASP Top 10)
2. Performance issues (N+1 queries, memory leaks)
3. Code quality (DRY, SOLID, proper error handling)
4. Best practices for the framework
5. Bug and edge case identification

Provide specific, actionable feedback with severity levels.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: [
      "readFile",
      "listDirectory",
      "searchFiles",
      "grep",
      "gitDiff",
      "gitLog",
    ],
    defaultSkills: ["code-review-pro", "software-architecture"],
    maxToolCalls: 15,
  },
};
