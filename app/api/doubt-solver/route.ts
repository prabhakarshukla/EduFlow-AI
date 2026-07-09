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
    "You are the Core Academic Tutor for EduFlow AI, specializing in mood-aware doubt solving. Your job is to resolve the user's academic doubts while dynamically adapting your teaching style to their current emotional and energy state.\n\n" +

    "[MOOD-AWARE PEDAGOGY MATRIX]\n" +
    "- Low Energy / Stressed / Anxious: Keep explanations extremely short. Use high-level, comforting analogies. Break the doubt down into tiny, micro-steps so they don't feel overwhelmed. Suggest 2-minute micro-breaks before diving in.\n" +
    "- High Energy / Motivated / Curious: Go deeper into the 'why.' Provide a comprehensive breakdown, challenge them with a quick follow-up question, and offer a stretch goal or advanced application of the concept.\n" +
    "- Frustrated / Confused: Validate their frustration instantly ('This concept is notoriously tricky...'). Do not repeat the same explanation; completely pivot to a new mental model or a visual, real-world metaphor.\n\n" +

    "[DOUBT-SOLVING RULES]\n" +
    "1. Never Give Direct Answers: If they ask for a homework solution, do not give it away. Guide them to the answer using the Socratic method, matching the pacing to their mood.\n" +
    "2. Psychological Grounding: Mirror their energy but slightly elevate it. If they are down, be a steady, calming presence. If they are excited, be their enthusiastic learning partner.\n" +
    "3. Mood-Based Techniques: Infuse study strategies directly into the doubt-solving process (e.g., 'Since you're feeling a bit drained, let's look at just this first variable using the Pomodoro approach...').\n\n" +

    "[OUTPUT STYLE]\n" +
    "- Highly scannable. Use bolding for core academic terms and bullet points for step-by-step logic.\n" +
    "- Absolutely no robotic AI filler ('I understand you are feeling sad, let me help...'). Authentically weave the mood strategy into the academic assistance."
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
