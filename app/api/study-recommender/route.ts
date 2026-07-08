import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudyTask {
  subject: string;
  deadline: string;
  priority: "low" | "medium" | "high";
}

interface TimeSlot {
  time: string;
  subject: string;
  recommendation: string;
}

interface DaySchedule {
  date: string;
  slots: TimeSlot[];
}

interface StudyPlanResponse {
  summary: string;
  recommendations: string[];
  timetable: DaySchedule[];
}

// ─── Gemini client ─────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.0-flash";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800; // base delay, doubles each retry

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Detects retryable errors: 503 / UNAVAILABLE / overloaded / rate limit
function isRetryableError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();

  return (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("timeout")
  );
}

/**
 * Calls Gemini with automatic retries (for transient errors) and a fallback
 * model if the primary model is unavailable after all retries.
 */
async function generateWithRetry(prompt: string): Promise<string> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    const isLastModel = modelIndex === models.length - 1;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        const text = result.text ?? "";
        if (!text) throw new Error("Empty response from Gemini.");

        return text;
      } catch (err) {
        const retryable = isRetryableError(err);
        const isLastAttempt = attempt === MAX_RETRIES;

        console.error(
          `[study-plan] ${model} attempt ${attempt}/${MAX_RETRIES} failed:`,
          err instanceof Error ? err.message : err,
        );

        // If this error isn't retryable, bail out of retries for this model
        // immediately and try the next model (if any).
        if (!retryable) break;

        // If retryable but not the last attempt, wait and retry the same model.
        if (!isLastAttempt) {
          await sleep(RETRY_DELAY_MS * attempt); // linear backoff: 0.8s, 1.6s, 2.4s
          continue;
        }

        // Retryable but exhausted retries on this model.
        // If this was the last model too, give up.
        if (isLastModel) {
          throw new Error(
            "AI service is temporarily unavailable. Please try again in a moment.",
          );
        }
        // Otherwise fall through to try the next (fallback) model.
      }
    }
  }

  // Should not be reachable, but keeps TypeScript happy.
  throw new Error(
    "AI service is temporarily unavailable. Please try again in a moment.",
  );
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
 
  try {
    const formData = await req.formData();

    const tasks: StudyTask[] = JSON.parse(
      String(formData.get("tasks") || "[]"),
    );

    const weakSubjects = String(formData.get("weakSubjects") || "");
    const syllabusText = String(formData.get("syllabusText") || "");

    // ── Input validation ───────────────────────────────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured. Please contact support." },
        { status: 500 },
      );
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: "No tasks provided. Please add at least one task." },
        { status: 400 },
      );
    }

    // ── Build prompt ───────────────────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];

const prompt = `You are the EduFlow AI algorithmic Study Planner. Your objective is to build a mathematically optimized, realistic 7-day study schedule starting from ${today}.

[DATA INPUTS]
Today's Reference Date: ${today}

Current Tasks & Deadlines:
${JSON.stringify(tasks, null, 2)}

Student's Weak Subjects (Priority allocation required):
${JSON.stringify(weakSubjects || [], null, 2)}

Available Syllabus Context:
${syllabusText ? syllabusText.slice(0, 3000) : "Not provided"}

[SCHEDULING ALGORITHM & CONSTRAINT RULES]
1. Chronological Priority: Prioritize subjects with the nearest upcoming deadlines from ${today}.
2. Weakness Loading: Dynamically allocate double the daily time slots to "Weak Subjects" compared to strong subjects, until deadlines are mitigated.
3. Hard Cap Constraints: Schedule exactly 4 blocks per day. Block 1 starts at 09:00. Each slot must be exactly 1 hour (e.g., "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00"). Do not skip hours within a day's schedule.
4. Actionable Content: The "recommendation" string inside each slot must map a specific task or syllabus sub-topic to that hour. 
5. Strict Length Constraints: 
   - Every individual recommendation string must be maximum 12 words.
   - The overall blueprint "summary" must be maximum 20 words.

[OUTPUT SPECIFICATION]
Return ONLY a raw, valid JSON object matching the exact schema below. Do NOT wrap the output in markdown code blocks (such as \`\`\`json), backticks, or prepend/append any text conversational chatter. The response must start strictly with '{' and end strictly with '}'.

{
  "summary": "String (Max 20 words overview of the weekly strategy)",
  "recommendations": [
    "String (High-level actionable rule 1, max 12 words)",
    "String (High-level actionable rule 2, max 12 words)",
    "String (High-level actionable rule 3, max 12 words)"
  ],
  "timetable": [
    {
      "date": "YYYY-MM-DD",
      "slots": [
        {
          "time": "HH:MM - HH:MM",
          "subject": "String (Subject Name matching the task or syllabus entry)",
          "recommendation": "String (Micro-target for this specific hour, max 12 words)"
        }
      ]
    }
  ]
}`
;

    // ── Call Gemini (with retries + fallback model) ────────────────────────────
    let rawText: string;
    try {
      rawText = await generateWithRetry(prompt);
    } catch (err) {
      // User-friendly message — never expose raw Gemini error details.
      const message =
        err instanceof Error
          ? err.message
          : "AI service is temporarily unavailable. Please try again in a moment.";

      return NextResponse.json({ error: message }, { status: 503 });
    }

    // Strip markdown fences if the model ignores the instruction
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let json: StudyPlanResponse;
    try {
      json = JSON.parse(cleaned);
    } catch {
      console.error("[study-plan] Failed to parse Gemini output:", cleaned);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 },
      );
    }

    // ── Validate shape ─────────────────────────────────────────────────────────
    if (
      typeof json.summary !== "string" ||
      !Array.isArray(json.recommendations) ||
      !Array.isArray(json.timetable)
    ) {
      console.error("[study-plan] Unexpected JSON shape:", json);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(json);
  } catch (error) {
    // Catch-all — log full details server-side, return generic message to client.
    console.error("[study-plan] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong while generating your study plan. Please try again.",
      },
      { status: 500 },
    );
  }
}
