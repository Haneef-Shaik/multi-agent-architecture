import EventEmitter from "eventemitter3";
import type { AgentEvent } from "@/types/agent";

export interface BusEvents {
  "agent:started": (event: AgentEvent) => void;
  "agent:progress": (event: AgentEvent) => void;
  "agent:tool:call": (event: AgentEvent) => void;
  "agent:tool:result": (event: AgentEvent) => void;
  "agent:text": (event: AgentEvent) => void;
  "agent:completed": (event: AgentEvent) => void;
  "agent:error": (event: AgentEvent) => void;
  "agent:handoff": (event: AgentEvent) => void;
  "task:created": (data: { taskId: string; dag: unknown }) => void;
  "task:completed": (data: { taskId: string; results: unknown }) => void;
  "skill:loaded": (data: {
    skillName: string;
    level: "metadata" | "body" | "references";
  }) => void;
}

class MessageBus extends EventEmitter<BusEvents> {
  emitAgentEvent(event: AgentEvent): void {
    this.emit(event.type as keyof BusEvents, event as never);
  }
}

// Singleton message bus
export const bus = new MessageBus();
