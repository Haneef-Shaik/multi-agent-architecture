import { EventEmitter } from "events";

/**
 * MCP (Model Context Protocol) client.
 * Supports stdio, SSE, and HTTP transports for connecting to MCP servers.
 */

export interface MCPServerConfig {
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string; // for stdio transport
  args?: string[]; // for stdio transport
  url?: string; // for sse/http transport
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface MCPMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class MCPClient extends EventEmitter {
  private config: MCPServerConfig;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private connected = false;
  private abortController: AbortController | null = null;

  // stdio transport
  private process: import("child_process").ChildProcess | null = null;
  private buffer = "";

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    switch (this.config.transport) {
      case "stdio":
        await this.connectStdio();
        break;
      case "sse":
        await this.connectSSE();
        break;
      case "http":
        // HTTP is stateless, no persistent connection needed
        this.connected = true;
        break;
      default:
        throw new Error(`Unknown transport: ${this.config.transport}`);
    }

    // Initialize the MCP session
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: false },
      },
      clientInfo: {
        name: "superagent-platform",
        version: "1.0.0",
      },
    });

    // Send initialized notification
    this.notify("notifications/initialized", {});
  }

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error("stdio transport requires a command");
    }

    const { spawn } = await import("child_process");

    const env = { ...process.env, ...this.config.env };
    this.process = spawn(this.config.command, this.config.args ?? [], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout!.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr!.on("data", (data: Buffer) => {
      this.emit("stderr", data.toString());
    });

    this.process.on("exit", (code) => {
      this.connected = false;
      this.emit("disconnect", code);
    });

    this.connected = true;
  }

  private async connectSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error("SSE transport requires a url");
    }

    this.abortController = new AbortController();

    const response = await fetch(this.config.url, {
      headers: {
        Accept: "text/event-stream",
        ...this.config.headers,
      },
      signal: this.abortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const msg = JSON.parse(line.slice(6)) as MCPMessage;
                this.handleMessage(msg);
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } catch {
        // Connection closed
      }
      this.connected = false;
      this.emit("disconnect", null);
    };

    readLoop();
    this.connected = true;
  }

  private processBuffer(): void {
    // MCP stdio uses newline-delimited JSON
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as MCPMessage;
        this.handleMessage(msg);
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  private handleMessage(msg: MCPMessage): void {
    // Response to a request
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);

      if (msg.error) {
        pending.reject(
          new Error(`MCP error ${msg.error.code}: ${msg.error.message}`)
        );
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    // Server notification
    if (msg.method) {
      this.emit("notification", { method: msg.method, params: msg.params });
    }
  }

  private async request(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const id = ++this.requestId;
    const msg: MCPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timed out: ${method}`));
        }
      }, 30_000);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.sendMessage(msg);
    });
  }

  private notify(
    method: string,
    params: Record<string, unknown>
  ): void {
    const msg: MCPMessage = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.sendMessage(msg);
  }

  private sendMessage(msg: MCPMessage): void {
    const serialized = JSON.stringify(msg);

    switch (this.config.transport) {
      case "stdio":
        if (this.process?.stdin) {
          this.process.stdin.write(serialized + "\n");
        }
        break;
      case "sse":
      case "http":
        // For SSE/HTTP, send via POST to the endpoint
        if (this.config.url) {
          fetch(this.config.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...this.config.headers,
            },
            body: serialized,
          }).catch((err) => this.emit("error", err));
        }
        break;
    }
  }

  /**
   * List available tools from the MCP server.
   */
  async listTools(): Promise<MCPTool[]> {
    const result = (await this.request("tools/list", {})) as {
      tools: MCPTool[];
    };
    return result.tools ?? [];
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text?: string }> }> {
    const result = (await this.request("tools/call", {
      name,
      arguments: args,
    })) as { content: Array<{ type: string; text?: string }> };
    return result;
  }

  /**
   * List available resources from the MCP server.
   */
  async listResources(): Promise<MCPResource[]> {
    const result = (await this.request("resources/list", {})) as {
      resources: MCPResource[];
    };
    return result.resources ?? [];
  }

  /**
   * Read a resource by URI.
   */
  async readResource(
    uri: string
  ): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string }> }> {
    const result = (await this.request("resources/read", { uri })) as {
      contents: Array<{ uri: string; mimeType?: string; text?: string }>;
    };
    return result;
  }

  /**
   * List available prompts from the MCP server.
   */
  async listPrompts(): Promise<
    Array<{ name: string; description?: string; arguments?: Array<{ name: string; required?: boolean }> }>
  > {
    const result = (await this.request("prompts/list", {})) as {
      prompts: Array<{
        name: string;
        description?: string;
        arguments?: Array<{ name: string; required?: boolean }>;
      }>;
    };
    return result.prompts ?? [];
  }

  /**
   * Get a prompt with arguments resolved.
   */
  async getPrompt(
    name: string,
    args: Record<string, string>
  ): Promise<{ description?: string; messages: Array<{ role: string; content: unknown }> }> {
    const result = (await this.request("prompts/get", {
      name,
      arguments: args,
    })) as {
      description?: string;
      messages: Array<{ role: string; content: unknown }>;
    };
    return result;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.abortController?.abort();
    this.process?.kill();
    this.pendingRequests.clear();
  }
}

/**
 * MCP Server Registry — manages connections to multiple MCP servers.
 */
export class MCPRegistry {
  private clients = new Map<string, MCPClient>();
  private toolCache = new Map<string, { serverName: string; tool: MCPTool }>();

  /**
   * Connect to an MCP server and cache its tools.
   */
  async addServer(config: MCPServerConfig): Promise<MCPTool[]> {
    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(config.name, client);

    const tools = await client.listTools();
    for (const tool of tools) {
      this.toolCache.set(`${config.name}:${tool.name}`, {
        serverName: config.name,
        tool,
      });
    }

    return tools;
  }

  /**
   * Remove an MCP server connection.
   */
  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);

      // Remove cached tools for this server
      for (const [key, value] of this.toolCache) {
        if (value.serverName === name) {
          this.toolCache.delete(key);
        }
      }
    }
  }

  /**
   * List all available tools across all connected servers.
   */
  listAllTools(): Array<{ serverName: string; tool: MCPTool }> {
    return Array.from(this.toolCache.values());
  }

  /**
   * Call a tool on its corresponding server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server not found: ${serverName}`);
    if (!client.isConnected)
      throw new Error(`MCP server disconnected: ${serverName}`);

    const result = await client.callTool(toolName, args);
    return (
      result.content
        .map((c) => c.text ?? JSON.stringify(c))
        .join("\n") || "(no output)"
    );
  }

  /**
   * Disconnect all servers.
   */
  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.toolCache.clear();
  }
}
