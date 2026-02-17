import { ObjectId } from "mongodb";

export interface Attachment {
  type: "image" | "file";
  name: string;
  url?: string;
  content?: string; // base64 for images
  mimeType: string;
}

export interface PersistedToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface MessageMetadata {
  model?: string;
  tokensUsed?: { input: number; output: number };
  agentId?: string;
  skillsUsed?: string[];
  toolCalls?: PersistedToolCall[];
}

export interface Message {
  _id?: ObjectId;
  sessionId: ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
  agentExecutionId?: ObjectId;
  metadata?: MessageMetadata;
  createdAt: Date;
}

export interface Session {
  _id?: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  title?: string;
  summary?: string;
  status: "active" | "archived";
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
