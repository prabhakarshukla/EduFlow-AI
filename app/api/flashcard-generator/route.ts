import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";

type FlashcardResponse = {
  flashcards?: {
    question: string;
    answer: string;
  }[];
};

async function generateFlashcards(content: string) {
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

  return JSON.parse(cleaned) as FlashcardResponse;
}

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    let parsed: FlashcardResponse | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        parsed = await generateFlashcards(content);

        if (Array.isArray(parsed.flashcards)) {
          break;
        }
      } catch (error) {
        console.error(
          `[flashcard-generator] attempt ${attempt} failed:`,
          error
        );
      }
    }

    if (!parsed || !Array.isArray(parsed.flashcards)) {
      return NextResponse.json(
        { error: "Internal Error occured" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      flashcards: parsed.flashcards,
    });
  } catch (error) {
    console.error("[flashcard-generator] request failed:", error);

    return NextResponse.json(
      { error: "Internal Error occured" },
      { status: 500 }
    );
  }
}