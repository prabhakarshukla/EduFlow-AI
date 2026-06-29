import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";


type MoodLevel = "tired" | "neutral" | "motivated";

const mooddetailss: Record<MoodLevel, string> = {
  tired: "I'm feeling tired and low on energy",
  neutral: "I'm feeling okay, neither energized nor drained",
  motivated: "I'm feeling motivated and energized",
};

export async function POST(req: Request) {
  
  try {
    const body = (await req.json()) as {
      mood?: MoodLevel;
      recentTasks?: string[];
    };
    const mood = body.mood?.toLowerCase() as MoodLevel | undefined;

    if (!mood || !mooddetailss[mood]) {
      return NextResponse.json(
        { error: "Valid mood is required: tired, neutral, or motivated" },
        { status: 400 },
      );
    }

    const recentTasks = Array.isArray(body.recentTasks)
      ? body.recentTasks.filter((task): task is string => typeof task === "string")
      : [];
    const taskContext = recentTasks.length
      ? ` Recent tasks/subjects: ${recentTasks.join(", ")}.`
      : "";
    const suggestion = await routeAgent({
      agentType: "mood",
      userMessage:
        `${mooddetailss[mood]}. Give 2-3 short, actionable study suggestions for right now.` +
        taskContext,
      context: { source: "mood-suggestions", mood, recentTasks },
    });

    if (!suggestion?.trim()) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      suggestion,
      mood,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected server error while generating mood suggestions.",
      },
      { status: 500 },
    );
  }
}
