import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const result = await routeAgent({
      agentType: "flashcard",
      userMessage: `Generate flashcards from this study material:\n\n${content}`,
      context: {
        source: "flashcard-generator",
      },
    });

    const cleaned = result
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!parsed || !Array.isArray(parsed.flashcards)) {
      return NextResponse.json(
        { error: "Invalid flashcard format returned by AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      flashcards: parsed.flashcards,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate flashcards",
      },
      { status: 500 }
    );
  }
}