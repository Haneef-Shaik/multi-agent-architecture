"use client";

import { useRef, useCallback, useReducer } from "react";
import type { AgentStep } from "@/components/agents/agent-status-bar";
import type { TimelineEntry } from "@/components/agents/agent-timeline";
import type { ToolCallInfo } from "@/components/agents/tool-call-display";

interface AgentEventsState {
  status: "idle" | "planning" | "executing" | "completed" | "error";
  plan: string;
  steps: AgentStep[];
  timeline: TimelineEntry[];
  toolCalls: Map<string, ToolCallInfo>;
  error: string | null;
}

type AgentEventsAction =
  | { type: "RESET" }
  | { type: "PLANNING_STARTED" }
  | { type: "PLAN_RECEIVED"; plan: string; steps: Array<{ agentId: string; skills: string[]; task: string }> }
  | { type: "AGENT_STARTED"; nodeId: string; agentId: string; skills: string[] }
  | { type: "AGENT_COMPLETED"; nodeId: string; agentId: string }
  | { type: "AGENT_ERROR"; nodeId: string; agentId: string; error: string }
  | { type: "TOOL_CALL"; agentId: string; tool: string; args: Record<string, unknown> }
  | { type: "TOOL_RESULT"; agentId: string; tool: string; result: string }
  | { type: "EXECUTION_DONE" }
  | { type: "EXECUTION_ERROR"; error: string };

function createInitialState(): AgentEventsState {
  return {
    status: "idle",
    plan: "",
    steps: [],
    timeline: [],
    toolCalls: new Map(),
    error: null,
  };
}

let entryCounter = 0;
function nextId(): string {
  return `entry-${++entryCounter}`;
}

function reducer(
  state: AgentEventsState,
  action: AgentEventsAction
): AgentEventsState {
  switch (action.type) {
    case "RESET":
      return createInitialState();

    case "PLANNING_STARTED":
      return {
        ...state,
        status: "planning",
      };

    case "PLAN_RECEIVED": {
      const steps: AgentStep[] = action.steps.map((s, i) => ({
        nodeId: `step-${i}`,
        agentId: s.agentId,
        status: "pending",
        skills: s.skills,
      }));
      const entry: TimelineEntry = {
        id: nextId(),
        type: "plan",
        timestamp: Date.now(),
        data: {
          plan: action.plan,
          steps: action.steps,
        },
      };
      return {
        ...state,
        status: "executing",
        plan: action.plan,
        steps,
        timeline: [...state.timeline, entry],
      };
    }

    case "AGENT_STARTED": {
      const steps = state.steps.map((s) =>
        s.nodeId === action.nodeId ? { ...s, status: "running" as const } : s
      );
      const entry: TimelineEntry = {
        id: nextId(),
        type: "agent_start",
        timestamp: Date.now(),
        agentId: action.agentId,
        data: { skills: action.skills },
      };
      return {
        ...state,
        steps,
        timeline: [...state.timeline, entry],
      };
    }

    case "AGENT_COMPLETED": {
      const steps = state.steps.map((s) =>
        s.nodeId === action.nodeId ? { ...s, status: "completed" as const } : s
      );
      const entry: TimelineEntry = {
        id: nextId(),
        type: "agent_complete",
        timestamp: Date.now(),
        agentId: action.agentId,
        data: {},
      };
      return {
        ...state,
        steps,
        timeline: [...state.timeline, entry],
      };
    }

    case "AGENT_ERROR": {
      const steps = state.steps.map((s) =>
        s.nodeId === action.nodeId ? { ...s, status: "failed" as const } : s
      );
      const entry: TimelineEntry = {
        id: nextId(),
        type: "agent_error",
        timestamp: Date.now(),
        agentId: action.agentId,
        data: { error: action.error },
      };
      return {
        ...state,
        steps,
        timeline: [...state.timeline, entry],
      };
    }

    case "TOOL_CALL": {
      const tcId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tc: ToolCallInfo = {
        id: tcId,
        toolName: action.tool,
        args: action.args,
        status: "running",
        timestamp: Date.now(),
      };
      const newMap = new Map(state.toolCalls);
      newMap.set(action.tool, tc);

      const entry: TimelineEntry = {
        id: nextId(),
        type: "tool_call",
        timestamp: Date.now(),
        agentId: action.agentId,
        data: tc as unknown as Record<string, unknown>,
      };
      return {
        ...state,
        toolCalls: newMap,
        timeline: [...state.timeline, entry],
      };
    }

    case "TOOL_RESULT": {
      const existing = state.toolCalls.get(action.tool);
      if (existing) {
        const updated: ToolCallInfo = {
          ...existing,
          result: action.result,
          status: "completed",
          duration: Date.now() - existing.timestamp,
        };
        const newMap = new Map(state.toolCalls);
        newMap.set(action.tool, updated);

        // Update the last tool_call timeline entry for this tool
        const timeline = [...state.timeline];
        for (let i = timeline.length - 1; i >= 0; i--) {
          const e = timeline[i];
          if (
            e.type === "tool_call" &&
            (e.data as unknown as ToolCallInfo).toolName === action.tool &&
            (e.data as unknown as ToolCallInfo).status === "running"
          ) {
            timeline[i] = {
              ...e,
              data: updated as unknown as Record<string, unknown>,
            };
            break;
          }
        }

        return { ...state, toolCalls: newMap, timeline };
      }
      return state;
    }

    case "EXECUTION_DONE":
      return { ...state, status: "completed" };

    case "EXECUTION_ERROR":
      return { ...state, status: "error", error: action.error };

    default:
      return state;
  }
}

/**
 * Hook that manages agent execution events from the SSE stream.
 * Produces state for AgentStatusBar, AgentTimeline, and ToolCallDisplay.
 */
export function useAgentEvents() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const handleSSEEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case "supervisor.planning":
          dispatch({ type: "PLANNING_STARTED" });
          break;

        case "supervisor.plan":
          dispatch({
            type: "PLAN_RECEIVED",
            plan: String(data.plan ?? ""),
            steps: ((data.dag as Record<string, unknown>)?.nodes as Array<{
              agentId: string;
              skills: string[];
              input: string;
            }>)?.map((n) => ({
              agentId: n.agentId,
              skills: n.skills ?? [],
              task: n.input,
            })) ?? [],
          });
          break;

        case "agent.started":
          dispatch({
            type: "AGENT_STARTED",
            nodeId: String(data.nodeId ?? ""),
            agentId: String(data.agentId ?? ""),
            skills: (data.skills as string[]) ?? [],
          });
          break;

        case "agent.completed":
          dispatch({
            type: "AGENT_COMPLETED",
            nodeId: String(data.nodeId ?? ""),
            agentId: String(data.agentId ?? ""),
          });
          break;

        case "agent.error":
          dispatch({
            type: "AGENT_ERROR",
            nodeId: String(data.nodeId ?? ""),
            agentId: String(data.agentId ?? ""),
            error: String(data.error ?? "Unknown error"),
          });
          break;

        case "agent.tool_call":
          dispatch({
            type: "TOOL_CALL",
            agentId: String(data.agentId ?? ""),
            tool: String(data.tool ?? ""),
            args: (data.args as Record<string, unknown>) ?? {},
          });
          break;

        case "agent.tool_result":
          dispatch({
            type: "TOOL_RESULT",
            agentId: String(data.agentId ?? ""),
            tool: String(data.tool ?? ""),
            result: String(data.result ?? ""),
          });
          break;

        case "done":
          dispatch({ type: "EXECUTION_DONE" });
          break;

        case "error":
          dispatch({
            type: "EXECUTION_ERROR",
            error: String(data.message ?? "Unknown error"),
          });
          break;
      }
    },
    []
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    ...state,
    handleSSEEvent,
    reset,
  };
}
