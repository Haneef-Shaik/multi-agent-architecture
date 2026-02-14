import { ObjectId } from "mongodb";

export type Framework =
  | "nextjs"
  | "react"
  | "vue"
  | "svelte"
  | "angular"
  | "python-flask"
  | "python-django"
  | "python-fastapi"
  | "express"
  | "static-html"
  | "custom";

export type SandboxStatus =
  | "provisioning"
  | "ready"
  | "active"
  | "hibernating"
  | "terminated"
  | "failed";

export interface MCPServerConfig {
  name: string;
  transport: "stdio" | "sse" | "http" | "websocket";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: "tcp" | "udp";
  label?: string;
}

export interface FileNode {
  path: string;
  type: "file" | "directory";
  size?: number;
  lastModified?: Date;
}

export interface ProjectSettings {
  nodeVersion?: string;
  pythonVersion?: string;
  packageManager: "bun" | "npm" | "pnpm" | "yarn" | "pip";
  envVars: Record<string, string>;
  mcpServers?: MCPServerConfig[];
  ports: number[];
}

export interface Project {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string;
  framework: Framework;
  settings: ProjectSettings;
  fileManifest?: {
    totalFiles: number;
    totalSizeBytes: number;
    tree: FileNode[];
  };
  templateId?: ObjectId;
  lastOpenedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sandbox {
  _id?: ObjectId;
  userId: ObjectId;
  projectId: ObjectId;
  containerId: string;
  vmNodeId?: string;
  status: SandboxStatus;
  ports: PortMapping[];
  resources: {
    cpuCores: number;
    memoryMB: number;
    diskMB: number;
  };
  volumePath: string;
  lastActiveAt: Date;
  createdAt: Date;
  terminatedAt?: Date;
}

export interface Template {
  _id?: ObjectId;
  name: string;
  description: string;
  framework: Framework;
  category: "frontend" | "fullstack" | "backend" | "mobile" | "cli";
  image?: string;
  files: { path: string; content: string }[];
  defaultPorts: number[];
  defaultEnvVars: Record<string, string>;
  popularity: number;
  createdAt: Date;
}
