import { ObjectId } from "mongodb";

export type AgentId =
  | "supervisor"
  | "planning"
  | "coding"
  | "debugging"
  | "testing"
  | "deploy"
  | "design"
  | "database"
  | "review";

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  model: string; // e.g., 'anthropic/claude-sonnet-4'
  tools: string[];
  defaultSkills: string[];
  maxToolCalls: number;
  temperature?: number;
}

export interface TaskDAG {
  id: string;
  nodes: TaskNode[];
  edges: TaskEdge[];
}

export interface TaskNode {
  id: string;
  agentId: AgentId;
  skills: string[];
  input: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
}

export interface TaskEdge {
  from: string;
  to: string;
  type: "dependency" | "data";
}

export interface AgentEvent {
  type:
    | "agent:started"
    | "agent:progress"
    | "agent:tool:call"
    | "agent:tool:result"
    | "agent:text"
    | "agent:completed"
    | "agent:error"
    | "agent:handoff";
  agentId: AgentId;
  taskId: string;
  timestamp: number;
  payload: unknown;
}

export interface ExecutionStep {
  stepId: string;
  agentId: AgentId;
  status: "pending" | "running" | "completed" | "failed";
  skillsLoaded: string[];
  toolCalls: ToolCallRecord[];
  textOutput?: string;
  duration: number;
  tokensUsed: { input: number; output: number };
}

export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration: number;
  timestamp: Date;
}

export interface AgentExecution {
  _id?: ObjectId;
  sessionId: ObjectId;
  userId: ObjectId;
  sandboxId: ObjectId;
  status: "running" | "completed" | "failed" | "cancelled";
  dag: TaskDAG;
  steps: ExecutionStep[];
  totalDuration: number;
  tokensUsed: { input: number; output: number };
  error?: { message: string; stack?: string };
  createdAt: Date;
  completedAt?: Date;
}

/**
 * User-created custom agent definition.
 * Follows the YAML frontmatter format from .agents/skills/agent-development/SKILL.md.
 */
export interface CustomAgent {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  skills: string[];
  maxToolCalls: number;
  color: string;
  icon?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
