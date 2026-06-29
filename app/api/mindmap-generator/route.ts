import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";


function parseCleanJson(text: string) {
  let cleaned = text.trim();
  // Strip code blocks if they are returned by the LLM
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "")
      .trim();
  }
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  
  try {
    const { topic } = await req.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    let rawOutput: string;
    try {
      rawOutput = await routeAgent({
        agentType: "mindmap",
        userMessage: topic,
        context: { source: "mindmap-generator", topic },
      });
    } catch (agentError) {
      const errorMessage =
        agentError instanceof Error ? agentError.message : "Unknown error";
      console.error("[mindmap-generator] Agent error:", errorMessage);
      return NextResponse.json(
        { error: `AI generation failed: ${errorMessage}` },
        { status: 500 },
      );
    }

    if (!rawOutput || !rawOutput.trim()) {
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again." },
        { status: 500 },
      );
    }

    try {
      const parsedData = parseCleanJson(rawOutput);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error(
        "[mindmap-generator] Failed to parse AI JSON response:",
        rawOutput,
        parseError,
      );
      return NextResponse.json(
        {
          error: "AI returned invalid JSON. Please try again.",
          rawResponse: rawOutput,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[mindmap-generator] Request error:", errorMessage);
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 },
    );
  }
}
