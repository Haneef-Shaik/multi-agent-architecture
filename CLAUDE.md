# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SuperAgent Platform** — a production-grade AI-powered application builder and agent builder. Users describe what they want in natural language, and AI agents collaboratively write, run, preview, and iterate on code inside isolated Docker sandboxes. Dual-mode UI: chat-based for non-technical users, full IDE for developers.

## Commands

| Task | Command |
|------|---------|
| Dev server | `bun dev` (port 3000) |
| Build | `bun run build` |
| Start prod | `bun run start` |
| Lint | `bun run lint` |
| Type check | `npx tsc --noEmit` |
| Install deps | `bun install` |
| Local infra | `docker compose -f docker/docker-compose.yml up -d` (MongoDB + Redis) |

Package manager is **Bun** (`bun.lock` present). No test framework is configured yet.

## Architecture

### Orchestrator (Supervisor/Worker + Task DAG)

The orchestrator lives in `lib/orchestrator/`. The **Supervisor** is the single entry point — it never writes code. It classifies user intent, decomposes tasks into a Directed Acyclic Graph (DAG), selects sub-agents + skills, then monitors execution.

**Execution flow:**
1. User message → `POST /api/agent/run` → Supervisor
2. Supervisor calls `generateObject()` with `ExecutionPlanSchema` to produce a structured DAG
3. Independent DAG nodes execute **in parallel** (e.g., PlanningAgent + DesignAgent)
4. Dependent nodes wait for upstream completion
5. All events streamed to client via SSE
6. Supervisor synthesizes final response from all agent outputs

**Key files:**
- `lib/orchestrator/supervisor.ts` — Supervisor class: plan creation, DAG execution, result synthesis
- `lib/orchestrator/agent-runner.ts` — `runAgent()` function, provider registry, tool definitions, all 8 `AGENT_CONFIGS`
- `lib/orchestrator/message-bus.ts` — EventEmitter3-based typed event bus

### Sub-Agents

| Agent | Role | Default Skills |
|-------|------|---------------|
| `planning` | Architecture, file structure, tech choices | `architecture-patterns`, `software-architecture` |
| `coding` | Write/edit code | `frontend-design` |
| `debugging` | Fix errors, interpret stack traces | `code-review-pro` |
| `testing` | Write and run tests | `code-review-pro` |
| `deploy` | Dockerfiles, CI/CD | `architecture-patterns` |
| `design` | UI/UX, styling | `frontend-design`, `color-palette-extractor`, `font-pairing-suggester` |
| `database` | Schema, migrations | `database-schema-designer` |
| `review` | Code quality gates | `code-review-pro`, `software-architecture` |

All agents use Vercel AI SDK's `streamText` with `stopWhen: stepCountIs(n)` for tool loop control.

### AI SDK Integration (v6)

Uses `ai@^6.0.86` with multi-provider support via `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`.

**Important v6 API notes:**
- Message type is `ModelMessage` (not `CoreMessage`)
- Tool definitions use `inputSchema` (not `parameters`)
- Tool loop control uses `stopWhen: stepCountIs(n)` (not `maxSteps`)
- Provider string format: `"anthropic/claude-sonnet-4-20250514"`, `"openai/gpt-4o"`, `"google/gemini-2.0-flash"`

### Skill System (105 skills)

Skills live in `.agents/skills/`. Each is a self-contained module:

```
.agents/skills/<skill-name>/
├── SKILL.md              # YAML frontmatter (name, description) + markdown body
├── scripts/              # Optional: executable code for deterministic tasks
├── references/           # Optional: documentation loaded on demand
└── assets/               # Optional: templates, icons, fonts
```

**3-Level Progressive Disclosure** (`lib/skills/registry.ts`):
1. **Metadata** — name + description, always in memory (~100 words/skill)
2. **Body** — Full SKILL.md markdown, loaded when Supervisor assigns skill to agent (1-5k words)
3. **References** — Files in `references/`, `scripts/`, loaded when agent explicitly requests

The `SkillRegistry` singleton scans all skills at startup, parses YAML frontmatter, and provides `getMetadataDigest()` for the Supervisor's context.

### Database (MongoDB)

Native MongoDB driver (not Mongoose). Connection singleton in `lib/db/client.ts`.

**Collections** (`lib/db/models/`):
- `users` — auth, preferences, usage tracking, plan tier
- `projects` — user projects with settings, framework, file manifest
- `sessions` — chat sessions per project
- `messages` — messages with agent execution references
- `agent_executions` — orchestrator run tracking with DAG, steps, tokens
- `sandboxes` — container lifecycle tracking
- `templates` — starter project templates

### Authentication (NextAuth v5)

`next-auth@5.0.0-beta.30` with JWT strategy. Providers: GitHub, Google.

- Config: `lib/auth/config.ts`
- Helper: `lib/auth/helpers.ts` — `requireAuth()` returns `AuthSession | NextResponse`
- Middleware: `middleware.ts` — protects `/projects/*`, `/api/projects/*`, `/api/agent/*`, `/api/sandbox/*`, `/api/sessions/*`
- Session callback attaches `userId` from MongoDB

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | ALL | NextAuth handlers |
| `/api/projects` | GET, POST | List/create projects |
| `/api/projects/[id]` | GET, PATCH, DELETE | Project CRUD |
| `/api/sessions` | GET, POST | List/create sessions |
| `/api/sessions/[id]` | GET | Session with messages |
| `/api/sessions/[id]/messages` | GET | Paginated messages |
| `/api/agent/run` | POST | Start agent execution (returns SSE stream) |
| `/api/skills` | GET | List skill metadata |

`POST /api/agent/run` is the main endpoint — it triggers the Supervisor and returns a `ReadableStream` with SSE-formatted events (`supervisor.planning`, `supervisor.plan`, `agent.started`, `agent.text`, `agent.completed`, `done`, `error`).

### Frontend

- **Next.js 16** with App Router, **React 19**, **Tailwind CSS v4**
- **Dual-mode workspace** (`components/workspace/workspace-layout.tsx`):
  - Simple mode: Chat + Preview (50/50 split)
  - Developer mode: File tree + Editor + Preview/Terminal
- **Chat UI**: `components/chat/chat-panel.tsx` with streaming via `hooks/use-agent-stream.ts`
- **State**: TanStack Query for server state, `useAgentStream` hook for SSE consumption
- Path alias: `@/*` maps to project root

### Docker Sandbox (Phase 2 — not yet implemented)

Base image in `docker/sandbox/Dockerfile`: Ubuntu 22.04 with Node.js 22, Bun, Python 3.12, Git, Chromium headless.

Resource limits per container: 2-4 CPU cores, 2-4 GB RAM, 10 GB disk, 256 PIDs.

Lifecycle: `CREATE → PROVISIONING → READY → ACTIVE → HIBERNATING → TERMINATED`

Local dev stack: `docker/docker-compose.yml` runs MongoDB 7 + Redis 7.

### Key Configuration

- TypeScript strict mode, target ES2017, bundler module resolution
- ESLint 9 flat config extending `next/core-web-vitals` and `next/typescript`
- CSS theme variables in `app/globals.css` with light/dark mode via `prefers-color-scheme`
- Environment variables documented in `.env.example`

## Implementation Status

- **Phase 1 (Foundation)**: Complete — MongoDB, auth, project/session CRUD, chat UI, single-agent execution, skill registry, orchestrator with DAG
- **Phase 2 (Sandbox)**: Pending — Docker container lifecycle, real tool implementations, WebSocket server, terminal UI
- **Phase 3 (Preview + Editor)**: Pending — Preview reverse proxy, Monaco editor, file tree, split-pane layout
- **Phase 4 (Orchestrator Polish)**: Pending — Full agent activity UI, skill matching improvements
- **Phase 5 (Scale)**: Pending — Browser tools, MCP client, templates, warm pool, remote VM, agent builder, rate limiting
