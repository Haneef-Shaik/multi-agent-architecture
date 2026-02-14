import { generateObject, streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { skillRegistry } from "@/lib/skills/registry";
import { runAgent, AGENT_CONFIGS } from "./agent-runner";
import { bus } from "./message-bus";
import { getProvider } from "@/lib/ai/providers";
import type { AgentId, TaskDAG, TaskNode, TaskEdge } from "@/types/agent";

// Schema for the Supervisor's structured output
const ExecutionPlanSchema = z.object({
  plan: z.string().describe("Brief description of the overall approach"),
  steps: z.array(
    z.object({
      agentId: z
        .enum([
          "planning",
          "coding",
          "debugging",
          "testing",
          "deploy",
          "design",
          "database",
          "review",
        ])
        .describe("Which agent handles this step"),
      skills: z
        .array(z.string())
        .describe("Skill names to load for this agent"),
      task: z.string().describe("What this agent should accomplish"),
      dependsOn: z
        .array(z.string())
        .optional()
        .describe(
          'Step IDs that must complete before this step (e.g., ["step-0"])'
        ),
    })
  ),
});

type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

/**
 * The Supervisor orchestrates the entire agent execution pipeline.
 *
 * Flow:
 * 1. Takes user message + conversation history
 * 2. Asks LLM to produce a structured execution plan (DAG)
 * 3. Executes the DAG: runs independent steps in parallel, respects dependencies
 * 4. Collects results and produces a final response
 */
export class Supervisor {
  private executionId: string;
  private containerId?: string;
  private modelOverride?: string;

  constructor(executionId: string, containerId?: string, model?: string) {
    this.executionId = executionId;
    this.containerId = containerId;
    this.modelOverride = model;
  }

  async execute(
    messages: ModelMessage[],
    options: {
      onText?: (delta: string) => void;
      onEvent?: (event: string, data: unknown) => void;
      signal?: AbortSignal;
    }
  ): Promise<string> {
    const { onText, onEvent, signal } = options;

    // Ensure skill registry is initialized
    await skillRegistry.initialize();

    // Step 1: Produce execution plan
    onEvent?.("supervisor.planning", { status: "started" });
    const plan = await this.createPlan(messages);
    const dag = this.planToDAG(plan);

    onEvent?.("supervisor.plan", { plan: plan.plan, dag });
    bus.emit("task:created", { taskId: this.executionId, dag });

    // Step 2: Execute the DAG
    const results = await this.executeDAG(dag, messages, {
      onText,
      onEvent,
      signal,
    });

    // Step 3: Synthesize final response
    const finalResponse = await this.synthesize(messages, plan, results, {
      onText,
      signal,
    });

    bus.emit("task:completed", {
      taskId: this.executionId,
      results: finalResponse,
    });

    return finalResponse;
  }

  private get supervisorModel() {
    return this.modelOverride ?? "anthropic/claude-sonnet-4-20250514";
  }

  private async createPlan(
    messages: ModelMessage[]
  ): Promise<ExecutionPlan> {
    const skillDigest = skillRegistry.getMetadataDigest();

    const result = await generateObject({
      model: getProvider(this.supervisorModel),
      schema: ExecutionPlanSchema,
      system: `You are the Supervisor agent for an AI-powered application builder. Your job is to analyze the user's request and produce an execution plan.

Available agents:
- planning: Designs architecture, file structure, tech choices
- coding: Writes and edits code files
- debugging: Analyzes errors and fixes bugs
- testing: Writes and runs tests
- deploy: Configures deployment and CI/CD
- design: Makes UI/UX and styling decisions
- database: Designs schemas and migrations
- review: Code review and quality gates

${skillDigest}

Create an efficient plan. Use parallel execution where possible (steps without dependencies can run simultaneously). Only include necessary agents — not every request needs all of them.

For simple requests (e.g., "write a hello world app"), keep it simple: just a coding agent.
For complex requests (e.g., "build a full-stack app with auth"), use multiple agents in sequence.`,
      messages,
    });

    return result.object;
  }

  private planToDAG(plan: ExecutionPlan): TaskDAG {
    const nodes: TaskNode[] = plan.steps.map((step, i) => ({
      id: `step-${i}`,
      agentId: step.agentId as AgentId,
      skills: step.skills,
      input: step.task,
      status: "pending",
    }));

    const edges: TaskEdge[] = [];
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          edges.push({ from: dep, to: `step-${i}`, type: "dependency" });
        }
      }
    }

    return { id: this.executionId, nodes, edges };
  }

  private async executeDAG(
    dag: TaskDAG,
    messages: ModelMessage[],
    options: {
      onText?: (delta: string) => void;
      onEvent?: (event: string, data: unknown) => void;
      signal?: AbortSignal;
    }
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const completed = new Set<string>();
    const running = new Set<string>();

    const getReadyNodes = () =>
      dag.nodes.filter((node) => {
        if (completed.has(node.id) || running.has(node.id)) return false;
        const deps = dag.edges
          .filter((e) => e.to === node.id)
          .map((e) => e.from);
        return deps.every((dep) => completed.has(dep));
      });

    while (completed.size < dag.nodes.length) {
      const ready = getReadyNodes();
      if (ready.length === 0 && running.size === 0) break; // deadlock protection
      if (ready.length === 0) {
        // Wait for running tasks
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      // Run all ready nodes in parallel
      const promises = ready.map(async (node) => {
        running.add(node.id);
        node.status = "running";

        options.onEvent?.("agent.started", {
          nodeId: node.id,
          agentId: node.agentId,
          skills: node.skills,
        });

        try {
          // Build context with results from dependency nodes
          const depResults = dag.edges
            .filter((e) => e.to === node.id)
            .map((e) => results.get(e.from))
            .filter(Boolean)
            .join("\n\n---\n\n");

          const agentMessages: ModelMessage[] = [
            ...messages,
            ...(depResults
              ? [
                  {
                    role: "user" as const,
                    content: `Previous agent results:\n\n${depResults}\n\nYour task: ${node.input}`,
                  },
                ]
              : [
                  {
                    role: "user" as const,
                    content: node.input,
                  },
                ]),
          ];

          const config = AGENT_CONFIGS[node.agentId];
          const result = await runAgent({
            agentConfig: this.modelOverride
              ? { ...config, model: this.modelOverride }
              : config,
            messages: agentMessages,
            skillNames: node.skills,
            taskId: node.id,
            containerId: this.containerId,
            onText: options.onText,
            signal: options.signal,
          });

          results.set(node.id, result);
          node.status = "completed";
          completed.add(node.id);

          options.onEvent?.("agent.completed", {
            nodeId: node.id,
            agentId: node.agentId,
          });
        } catch (error) {
          node.status = "failed";
          completed.add(node.id); // mark as done to prevent blocking
          results.set(
            node.id,
            `Error: ${error instanceof Error ? error.message : String(error)}`
          );

          options.onEvent?.("agent.error", {
            nodeId: node.id,
            agentId: node.agentId,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          running.delete(node.id);
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  private async synthesize(
    originalMessages: ModelMessage[],
    plan: ExecutionPlan,
    results: Map<string, string>,
    options: { onText?: (delta: string) => void; signal?: AbortSignal }
  ): Promise<string> {
    const resultsText = Array.from(results.entries())
      .map(([nodeId, result]) => `### ${nodeId}\n${result}`)
      .join("\n\n");

    let fullText = "";

    const stream = streamText({
      model: getProvider(this.supervisorModel),
      system: `You are synthesizing the results of multiple AI agents that worked on a user's request. Summarize what was accomplished, what files were created/modified, and what the user should do next. Be concise and helpful.`,
      messages: [
        ...originalMessages,
        {
          role: "user",
          content: `The execution plan was: ${plan.plan}\n\nAgent results:\n\n${resultsText}\n\nPlease provide a concise summary of what was accomplished for the user.`,
        },
      ],
      abortSignal: options.signal,
    });

    for await (const chunk of stream.textStream) {
      fullText += chunk;
      options.onText?.(chunk);
    }

    return fullText;
  }
}
