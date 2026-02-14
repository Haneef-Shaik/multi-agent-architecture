import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "@/lib/auth/helpers";
import { NextResponse } from "next/server";
import { findSessionById, incrementSessionMessageCount } from "@/lib/db/models/session";
import { createMessage } from "@/lib/db/models/message";
import { createExecution, updateExecution } from "@/lib/db/models/agent-execution";
import { Supervisor } from "@/lib/orchestrator/supervisor";
import type { ModelMessage } from "ai";
import { findMessagesBySession } from "@/lib/db/models/message";
import {
  agentExecutionLimiter,
  rateLimitHeaders,
} from "@/lib/utils/rate-limiter";

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  // Rate limiting
  const rateCheck = agentExecutionLimiter.check(session.userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before sending more messages." },
      {
        status: 429,
        headers: rateLimitHeaders(rateCheck),
      }
    );
  }

  const body = await request.json();
  const { sessionId, message, containerId, model } = body as {
    sessionId: string;
    message: string;
    containerId?: string;
    model?: string;
  };

  if (!sessionId || !message?.trim()) {
    return NextResponse.json(
      { error: "sessionId and message are required" },
      { status: 400 }
    );
  }

  // Validate session ownership
  const chatSession = await findSessionById(sessionId);
  if (!chatSession || chatSession.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Save the user message
  await createMessage({
    sessionId: new ObjectId(sessionId),
    role: "user",
    content: message.trim(),
  });
  await incrementSessionMessageCount(sessionId);

  // Load conversation history
  const history = await findMessagesBySession(sessionId, { limit: 50 });
  const coreMessages: ModelMessage[] = history.map((msg) => ({
    role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: msg.content,
  }));

  // Create execution record
  const execution = await createExecution({
    sessionId: new ObjectId(sessionId),
    userId: new ObjectId(session.userId),
    sandboxId: new ObjectId(), // placeholder until sandbox is provisioned
    status: "running",
    dag: { id: "", nodes: [], edges: [] },
    steps: [],
    totalDuration: 0,
    tokensUsed: { input: 0, output: 0 },
  });

  const executionId = execution._id!.toString();

  // Stream the response using SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const supervisor = new Supervisor(executionId, containerId, model);
        let assistantResponse = "";

        const result = await supervisor.execute(coreMessages, {
          onText(delta) {
            send("agent.text", { delta });
            assistantResponse += delta;
          },
          onEvent(event, data) {
            send(event, data);
          },
        });

        // Save assistant message
        await createMessage({
          sessionId: new ObjectId(sessionId),
          role: "assistant",
          content: result,
          agentExecutionId: execution._id,
          metadata: {
            skillsUsed: [],
          },
        });
        await incrementSessionMessageCount(sessionId);

        // Update execution status
        await updateExecution(executionId, {
          status: "completed",
          completedAt: new Date(),
        });

        send("done", { executionId });
        controller.close();
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);

        await updateExecution(executionId, {
          status: "failed",
          error: { message: errorMsg },
          completedAt: new Date(),
        });

        send("error", { message: errorMsg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
