import { NextRequest, NextResponse } from "next/server";
import { StreamingAgentRouter } from "@/lib/ai/streaming/streaming-agent-router";

export async function POST(req: NextRequest) {
  try {
    const { topic, agentType = "notes", context } = await req.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const streamingAgent = new StreamingAgentRouter();
    const stream = await streamingAgent.streamCompletion({
      userMessage: topic.trim(),
      agentType,
      context: context || { source: "notes-generator", topic: topic.trim() },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[streaming-api] Request error:", errorMessage);
    return NextResponse.json(
      { error: `Failed to process streaming request: ${errorMessage}` },
      { status: 500 },
    );
  }
}
