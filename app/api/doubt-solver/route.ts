import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";

type RequestBody = {
  question?: string;
  agentType?: "doubt" | "mood";
  userMessage?: string;
  context?: { selectedMood?: string; recentTasks?: string[] };
};

const mooddetailss: Record<string, string> = {
  tired: "I'm feeling tired and low on energy",
  neutral: "I'm feeling okay, neither energized nor drained",
  motivated: "I'm feeling motivated and energized",
};

function getMoodPrompt(
  selectedMood: string,
  recentTasks: string[] = [],
): string {
  const moodDesc = mooddetailss[selectedMood] || "feeling neutral";
  const taskContext =
    recentTasks.length > 0
      ? `\n\nRecent tasks/subjects: ${recentTasks.join(", ")}`
      : "";

  return (
    `${moodDesc}. Give me 2-3 short, actionable study suggestions that match my current mood and energy level. ` +
    `Keep each suggestion to 1-2 sentences. Focus on techniques that will help me study effectively right now.${taskContext}`
  );
}

function getMoodSystemPrompt(): string {
  return (
    "You are EduFlow AI, a helpful academic tutor focused on mood-aware productivity. " +
    "Provide personalized, actionable study suggestions based on the user's current mood and energy level. " +
    "Keep suggestions concise, friendly, and practical. " +
    "Consider their mood when recommending study techniques and break strategies."
  );
}

export async function POST(req: Request) {
  
  
  try {
    const body = (await req.json()) as {
      question?: string;
      userMessage?: string;
      agentType?: string;
      context?: string | Record<string, unknown>;
    };
    const userMessage = (body.userMessage ?? body.question)?.trim();
    const agentType = body.agentType?.trim() || "tutor";

    if (!userMessage) {
      return NextResponse.json(
        { error: "User message is required." },
        { status: 400 },
      );
    }

    const answer = await routeAgent({
      agentType,
      userMessage,
      context: body.context ?? { source: "doubt-solver" },
    });

    if (!answer || !answer.trim()) {
  return NextResponse.json(
    { error: "AI returned an empty answer." },
    { status: 502 }
  );
}

return NextResponse.json({
  answer,
  response: answer,
  success: true,
});
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected server error while processing request.",
      },
      { status: 500 },
    );
  }
}
