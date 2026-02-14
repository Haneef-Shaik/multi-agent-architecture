SuperAgent Platform — Full Architecture Plan
Context
The current repo is a bare-bones Next.js 16 boilerplate (no backend, no API routes, no custom pages) with a sophisticated 105-skill system in .agents/skills/. The goal is to build a production-grade AI-powered application builder and agent builder platform — a system where users describe what they want in natural language and AI agents collaboratively write, run, preview, and iterate on code inside isolated Docker sandboxes. Each user gets a remote VM with a Docker container per project.

Key decisions made:

LLM: Multi-provider via Vercel AI SDK (Claude, OpenAI, Gemini)
Database: MongoDB
Deployment: Cloud-agnostic
Target users: Dual-mode (chat for non-technical, IDE for developers)
1. System Overview

┌─────────────────── CLIENT BROWSER ───────────────────┐
│  Chat Panel │ Code Editor │ Terminal │ Preview (iframe)│
│  (React 19) │ (Monaco)    │ (xterm)  │ (live app)     │
└──────────┬──────────┬─────────┬────────────┬──────────┘
           │ WebSocket/SSE       │ REST API   │
           ▼                     ▼            ▼
┌─────────────────── NEXT.JS 16 SERVER ────────────────┐
│  Route Handlers (/api/*)  │  WebSocket Server        │
│  Auth (NextAuth v5)       │  Preview Reverse Proxy   │
├──────────────────────────────────────────────────────┤
│                  ORCHESTRATOR ENGINE                  │
│  ┌────────────┐    ┌─────────────────────────────┐   │
│  │ Supervisor │───▶│ Message Bus (EventEmitter3)  │   │
│  │ (Router)   │    └──────────┬──────────────────┘   │
│  └────────────┘               │                      │
│  ┌────────┐ ┌────────┐ ┌─────┴──┐ ┌────────┐       │
│  │Planning│ │Coding  │ │Debug   │ │Deploy  │        │
│  │Agent   │ │Agent   │ │Agent   │ │Agent   │        │
│  └────────┘ └────────┘ └────────┘ └────────┘        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │Design  │ │Database│ │Testing │ │Review  │        │
│  │Agent   │ │Agent   │ │Agent   │ │Agent   │        │
│  └────────┘ └────────┘ └────────┘ └────────┘        │
│                      │                               │
│  ┌───────────────────┴───────────────────────────┐   │
│  │ Skill Registry (105 skills, 3-level loading)  │   │
│  ├───────────────────────────────────────────────┤   │
│  │ Tool Layer (fs, terminal, browser, git, mcp)  │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌──────────┐  ┌──────────────┐
    │ MongoDB │  │  Redis   │  │ Sandbox Pool │
    │         │  │ (pub/sub │  │ ┌──────────┐ │
    │ users   │  │  + cache)│  │ │Docker    │ │
    │ projects│  │          │  │ │Container │ │
    │ sessions│  │          │  │ │(per user)│ │
    │ messages│  │          │  │ └──────────┘ │
    └─────────┘  └──────────┘  └──────────────┘
2. Orchestrator Architecture
Pattern: Supervisor/Worker with Task DAG execution.

The Supervisor Agent is the single entry point. It never writes code — it classifies intent, decomposes tasks into a DAG, selects sub-agents + skills, then monitors execution.

Sub-Agents
Agent	Role	Default Skills	Tools
PlanningAgent	Architecture, file structure, tech choices	architecture-patterns, software-architecture	fs(read), search
CodingAgent	Write/edit code	frontend-design, ai-sdk	fs(rw), terminal, package-mgr
DebugAgent	Fix errors, interpret stack traces	code-review-pro, regex-visual-debugger	fs, terminal, browser
TestingAgent	Write and run tests	code-review-pro	fs, terminal
DeployAgent	Dockerfiles, CI/CD, deployment config	architecture-patterns	fs, terminal, git
DesignAgent	UI/UX, styling, component design	frontend-design, color-palette-extractor, font-pairing-suggester	fs, browser
DatabaseAgent	Schema, migrations, seeds	database-schema-designer	fs, database, terminal
ReviewAgent	Code quality gates	code-review-pro, software-architecture	fs(read)
Execution Flow
User message → Supervisor
Supervisor produces a Task DAG (which agents, in what order, with what skills)
Independent DAG nodes execute in parallel (e.g., PlanningAgent + DesignAgent)
Dependent nodes wait (CodingAgent waits for plan + design)
All events streamed to client via WebSocket
Supervisor synthesizes final response
AI SDK Integration
Each agent runs via Vercel AI SDK's streamText with the ToolLoopAgent pattern (per .agents/skills/ai-sdk/SKILL.md):


const result = await streamText({
  model: registry.languageModel(agentConfig.model),
  system: agentConfig.systemPrompt + loadedSkillBodies,
  messages: contextWindow,
  tools: agentConfig.tools,
  maxSteps: 25,
  onStepFinish: (step) => bus.emit('agent:progress', { ... }),
});
Provider selection is per-agent configurable. The Vercel AI Gateway is the default provider.

Context Management
Short-term (conversation): messages, active tool calls, loaded skill bodies
Long-term (project, in MongoDB): file manifest, architectural decisions, error history
Context per agent call kept under 80% of model window; auto-summarization for overflow
3. Tool System
Every tool call flows through: Permission Check → Rate Limiter → Input Sanitization → Sandbox Client → Execute in Container → Output Capture → Event Emission → Return to Agent.

Tool Group	Operations
FileSystem	readFile, writeFile, editFile, searchFiles, listDir, delete, move
Terminal	executeCommand, startProcess, killProcess
Browser	screenshot (headless Chromium), navigate, click, type
Database	designSchema, runMigration, executeQuery, inspectSchema
Git	init, commit, diff, log, branch, checkout
PackageManager	install, uninstall, listDeps, runScript
Search	webSearch, docSearch
MCP	listServers, connectServer, callTool (supports stdio/SSE/HTTP/WS)
Tools execute inside the Docker sandbox via docker exec. All output is truncated at 100KB.

4. Sandbox Architecture (Docker)
Base Image (docker/sandbox/Dockerfile)

Ubuntu 22.04 slim
├── Node.js 22 LTS + Bun + pnpm
├── Python 3.12 + pip + venv
├── Git, curl, wget, jq, build-essential
├── Chromium headless (for screenshots)
├── inotify-tools (file watching)
└── Supervisor (process manager)
Resource Limits per Container
Resource	Soft	Hard
CPU	2 cores	4 cores
Memory	2 GB	4 GB
Disk	—	10 GB (project volume)
PIDs	—	256
Network	Rate-limited egress	No inter-container, no metadata endpoint
Lifecycle

CREATE → PROVISIONING → READY → ACTIVE → HIBERNATING → TERMINATED
Warm pool: 5-10 pre-created containers to reduce cold start to ~1s
Hibernation: After idle timeout, container paused (volume persists)
Termination: After extended idle, container removed (volume still persists)
Persistent volume at /workspace per project, survives container restarts
Port Mapping
Dev servers run on ports 3000-3010, 5173, 8000-8010 inside the container, dynamically mapped to host ports. A reverse proxy authenticates and routes preview requests.

Remote VM Support (Production)

API Server → Sandbox Router (consistent hashing by userId)
               ├── VM Node 1 (N containers)
               ├── VM Node 2 (N containers)
               └── VM Node N
Communication: gRPC (TLS) between API server and VM nodes
Provisioning: Terraform (cloud-agnostic)
5. Preview System
Preview URLs: /preview/{sandboxId}/{port}/{...path}

The Next.js server reverse-proxies to the correct container, supporting:

HTTP requests (page loads)
WebSocket upgrade (for HMR/hot reload)
Auth validation (user must own the sandbox)
Screenshot capture: docker exec chromium --headless --screenshot http://localhost:3000
→ returned as base64 image to the agent so it can "see" what it built.

Multiple preview tabs supported (frontend on :3000, API on :8000, etc.)

6. Frontend Architecture
Dual-Mode Layout
Simple Mode (non-technical):


┌─────────────────┬─────────────────┐
│   Chat Panel    │  Preview Panel  │
│   + Agent       │  (iframe)       │
│   Activity      │                 │
└─────────────────┴─────────────────┘
Developer Mode (full IDE):


┌──────┬──────────────┬─────────────────┐
│ File │ Code Editor  │ Preview/Terminal │
│ Tree │ (Monaco)     │ (tabs)          │
│      │ + Diff View  ├─────────────────┤
│      │              │ Agent Activity  │
│ Chat │              │ Panel           │
│ mini │              │                 │
└──────┴──────────────┴─────────────────┘
State Management
React Context + useReducer: workspace layout, mode, active panels
TanStack Query: projects, files, sandbox status (cached, invalidated)
WebSocket: chat streaming, agent activity, terminal I/O, file change notifications
Key Client Dependencies to Add
@monaco-editor/react — code editor
@xterm/xterm + @xterm/addon-fit — terminal
@tanstack/react-query — server state
allotment — resizable split panes
7. Real-time Communication
WebSocket primary, SSE fallback.

Channel Types
Channel	Direction	Purpose
chat:{sessionId}	Server→Client	Streamed agent text
agent:{sessionId}	Server→Client	Agent status, tool calls
terminal:{sandboxId}:{termId}	Bidirectional	Terminal I/O
files:{sandboxId}	Server→Client	File change notifications
preview:{sandboxId}	Server→Client	Reload signals
Redis Pub/Sub enables WebSocket fanout across multiple API server instances.

8. API Routes

/api/auth/[...nextauth]         — NextAuth handlers (GitHub, Google, email)
/api/projects                   — GET (list), POST (create)
/api/projects/[id]              — GET, PATCH, DELETE
/api/sessions                   — POST (create for project)
/api/sessions/[id]              — GET (with messages)
/api/sessions/[id]/messages     — GET (paginated)
/api/agent/run                  — POST (start execution, returns stream)
/api/agent/cancel               — POST (cancel running execution)
/api/sandbox/[id]               — GET (status), DELETE (terminate)
/api/sandbox/[id]/exec          — POST (run command)
/api/sandbox/[id]/files         — GET (read), PUT (write), DELETE
/api/sandbox/[id]/files/tree    — GET (file tree)
/api/sandbox/[id]/terminal      — POST (create terminal session)
/api/preview/[...path]          — ALL (reverse proxy to sandbox)
/api/templates                  — GET (list starters)
/api/skills                     — GET (list metadata)
/api/ws                         — GET (WebSocket upgrade)
Main endpoint: POST /api/agent/run triggers the orchestrator and returns a ReadableStream with SSE-formatted events (agent.started, agent.tool_call, agent.text, done).

9. Data Model (MongoDB)
Collections: users, projects, sessions, messages, agent_executions, sandboxes, templates

Key schemas:

User: email, authProvider, preferences (defaultMode, theme, defaultModel), apiKeys (encrypted), usage tracking, plan tier
Project: userId, name, framework, settings (envVars encrypted, mcpServers, ports), fileManifest, templateId
Session: projectId, userId, title, summary (AI-generated), status, messageCount
Message: sessionId, role, content, attachments, agentExecutionId, metadata (model, tokensUsed, skillsUsed)
AgentExecution: sessionId, sandboxId, status, dag (TaskDAG), steps[] (each with agentId, toolCalls[], duration, tokens), totalDuration
Sandbox: userId, projectId, containerId, vmNodeId, status, ports[], resources, volumePath
Template: name, framework, category, files[], defaultPorts, defaultEnvVars
Indexes on: { userId, updatedAt }, { projectId }, { sessionId, createdAt }, { email } unique.

10. Skill Integration
Skill Registry
At startup, parse YAML frontmatter from all 105 .agents/skills/*/SKILL.md files → in-memory metadata index (~10k tokens total).

3-Level Progressive Disclosure
Level	What	When	Cost
1. Metadata	name + description	Always in memory	~100 words/skill
2. Body	Full SKILL.md markdown	When Supervisor assigns skill to agent	1-5k words/skill
3. References	files in references/, scripts/	When agent explicitly requests	Unlimited
Selection Flow
Supervisor receives all 105 skill names+descriptions → LLM structured output selects which skills each sub-agent needs → bodies loaded and injected into agent system prompts → agents can request Level 3 references via tool call.

Agent Builder Feature
Users can create custom agents that leverage the existing 105 skills. The agent builder UI lets users:

Define agent name, description, system prompt
Select which skills the agent should use
Configure which tools the agent has access to
Set the LLM provider/model
Test the agent interactively
Save and share agents (stored in MongoDB)
This follows the format in .agents/skills/agent-development/SKILL.md — YAML frontmatter with name, description, model, color, tools, and a system prompt body.

11. Security
Container isolation: no --privileged, dropped capabilities, user namespace remapping, read-only rootfs (except /workspace, /tmp, /home), no Docker socket access
Network: egress allowlisted (npm, pip, GitHub), no inter-container, blocked metadata endpoints
Paths: resolved to absolute, must be within /workspace, symlinks rejected
Commands: non-root user, 120s timeout, 100KB output cap
Secrets: API keys AES-256-GCM encrypted at rest, decrypted only in-memory, never in agent context
Rate limiting: per-user limits on executions, commands, file ops, tokens, concurrent sandboxes
12. Directory Structure

superagent_architecture/
├── .agents/skills/              # 105 existing skills (untouched)
├── app/
│   ├── layout.tsx               # Root layout + providers
│   ├── page.tsx                 # Landing page
│   ├── globals.css
│   ├── (auth)/login/ + signup/
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Auth shell
│   │   ├── projects/page.tsx
│   │   ├── projects/[projectId]/page.tsx  # Main workspace
│   │   └── templates/page.tsx
│   └── api/                     # All route handlers (see §8)
├── lib/
│   ├── orchestrator/            # supervisor.ts, agents/*.ts, task-dag.ts, message-bus.ts, context-manager.ts
│   ├── skills/                  # registry.ts, loader.ts, matcher.ts
│   ├── tools/                   # filesystem.ts, terminal.ts, browser.ts, git.ts, mcp-client.ts, etc.
│   ├── sandbox/                 # manager.ts, docker-client.ts, exec.ts, file-watcher.ts, port-manager.ts
│   ├── realtime/                # ws-server.ts, sse-handler.ts, channel-manager.ts, protocol.ts
│   ├── db/                      # client.ts, models/*.ts
│   ├── auth/                    # config.ts, middleware.ts
│   └── utils/                   # crypto.ts, rate-limiter.ts, logger.ts
├── components/
│   ├── ui/                      # Primitives (button, input, dialog — shadcn/ui style)
│   ├── workspace/               # workspace-layout.tsx, panel-resizer.tsx, mode-switcher.tsx
│   ├── chat/                    # chat-panel.tsx, message-bubble.tsx, agent-activity-card.tsx, tool-call-display.tsx
│   ├── editor/                  # code-editor.tsx, file-tree.tsx, file-tabs.tsx, diff-view.tsx
│   ├── preview/                 # preview-panel.tsx, preview-tabs.tsx
│   ├── terminal/                # terminal-panel.tsx, terminal-tabs.tsx
│   └── agents/                  # agent-status-bar.tsx, agent-timeline.tsx, skill-badge.tsx
├── hooks/                       # use-realtime.ts, use-agent-stream.ts, use-sandbox.ts, use-terminal.ts
├── types/                       # agent.ts, project.ts, message.ts, skill.ts, realtime.ts, tool.ts
├── docker/
│   ├── sandbox/Dockerfile       # Sandbox base image
│   ├── sandbox/supervisor.conf
│   ├── sandbox/entrypoint.sh
│   └── docker-compose.yml       # Local dev stack (MongoDB + Redis + sandbox)
├── middleware.ts                 # Auth protection for routes
├── package.json
├── tsconfig.json
└── next.config.ts
13. Implementation Phases
Phase 1: Foundation
MongoDB connection + data models (lib/db/)
NextAuth v5 (GitHub + Google + email)
Project CRUD API + basic project list UI
Chat UI (ChatPanel, message storage/retrieval)
Single-agent execution (one CodingAgent via AI SDK, no orchestrator yet)
Phase 2: Sandbox
Docker base image build
SandboxManager (provision, exec, file read/write)
Tool implementations: filesystem, terminal, git, package-manager
WebSocket server for real-time streaming
Terminal UI (xterm.js connected to sandbox)
Phase 3: Preview + Editor
Preview reverse proxy
Monaco code editor integration
File tree component
Resizable split-pane workspace layout (dual-mode)
Phase 4: Orchestrator
Supervisor agent with intent routing + Task DAG
All 8 sub-agents
Skill registry with 3-level progressive loading
Message bus + event streaming to UI
Agent activity UI (status bar, timeline, tool call display)
Phase 5: Polish + Scale
Browser tools (screenshot, interaction via headless Chromium)
MCP client integration
Template system (starter projects)
Warm container pool
Remote VM sandbox support (gRPC, Terraform)
Agent builder feature (users create custom agents)
Rate limiting + security hardening
14. Verification Plan
After each phase, verify:

Phase 1: bun dev → can log in, create project, send chat message, get AI response streamed back
Phase 2: docker compose up → sandbox provisions, POST /api/sandbox/{id}/exec runs commands, terminal shows output in browser
Phase 3: Open project → see file tree, edit in Monaco, preview pane shows running dev server with hot reload
Phase 4: Send "Build a todo app" → Supervisor creates DAG, multiple agents execute in sequence, files appear in editor, app runs in preview
Phase 5: Full end-to-end: build app from description, iterate via chat, preview works, agent builder lets users create and test custom agents
15. Key Dependencies to Add

# Core
ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google  # Vercel AI SDK
mongodb                                                 # MongoDB driver
next-auth@5                                            # Authentication

# Frontend
@monaco-editor/react                                   # Code editor
@xterm/xterm @xterm/addon-fit @xterm/addon-web-links  # Terminal
@tanstack/react-query                                  # Server state
allotment                                              # Split panes
lucide-react                                           # Icons

# Realtime
ws                                                     # WebSocket server

# Infra
dockerode                                              # Docker API client
ioredis                                                # Redis client
eventemitter3                                          # Typed event bus

# Security
jose                                                   # JWT handling (NextAuth)