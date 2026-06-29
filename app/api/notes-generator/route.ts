import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";

export async function POST(req: Request) {
 
  try {
    const { topic } = await req.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    let notes: string;
    try {
      notes = await routeAgent({
        agentType: "notes",
        userMessage: topic,
        context: { source: "notes-generator", topic },
      });
    } catch (agentError) {
      const errorMessage =
        agentError instanceof Error ? agentError.message : "Unknown error";
      console.error("[notes-generator] Agent error:", errorMessage);
      return NextResponse.json(
        { error: `AI generation failed: ${errorMessage}` },
        { status: 500 },
      );
    }

    if (!notes || !notes.trim()) {
      return NextResponse.json(
        { error: "AI returned empty notes. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ notes });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[notes-generator] Request error:", errorMessage);
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 },
    );
  }
}
