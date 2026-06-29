import { NextResponse } from "next/server";
import { routeAgent } from "@/lib/ai/agents/agent-router";

export async function POST(req: Request) {
  try {
const formData = await req.formData();

const topic = (formData.get("topic") as string)?.trim() || "";

const file = formData.get("file") as File | null;

if (!topic && !file) {
  return NextResponse.json(
    {
      error: "Provide either a topic or upload notes."
    },
    {
      status: 400,
    }
  );
}

let promptContent = "";
let inputType = "";

if (file) {
  promptContent = await file.text();
  inputType = "notes";
} else {
  promptContent = topic;
  inputType = "topic";
}

    let quiz;

    try {
     quiz = await routeAgent({
  agentType: "quiz",

  userMessage:
    inputType === "notes"
      ? `Generate a quiz ONLY from these study notes.

${promptContent}

Generate:
- 5 Multiple Choice Questions
- 3 True/False Questions
- 2 Short Answer Questions

Return ONLY valid JSON in this format:

{
  "questions": [
    {
      "type": "mcq",
      "question": "...",
      "options": [],
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}`
      : `Generate a quiz on the following topic:

${promptContent}

Generate:
- 5 Multiple Choice Questions
- 3 True/False Questions
- 2 Short Answer Questions

Return ONLY valid JSON in this format:

{
  "questions": [
    {
      "type": "mcq",
      "question": "...",
      "options": [],
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}`,

  context: {
    source: "quiz-generator",
    inputType,
  },
});
    } catch (agentError) {
      const errorMessage =
        agentError instanceof Error
          ? agentError.message
          : "Unknown error";

      console.error(
        "[quiz-generator] Agent error:",
        errorMessage
      );

      return NextResponse.json(
        {
          error: `AI generation failed: ${errorMessage}`,
        },
        {
          status: 500,
        }
      );
    }

    if (!quiz || !quiz.trim()) {
      return NextResponse.json(
        {
          error:
            "AI returned an empty quiz. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    let parsedQuiz;

    try {
      console.log(
        "========== RAW AI RESPONSE =========="
      );
      console.log(quiz);
      console.log(
        "===================================="
      );

      const cleanedQuiz = quiz
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      console.log(
        "========== CLEANED AI RESPONSE =========="
      );
      console.log(cleanedQuiz);
      console.log(
        "========================================="
      );

      parsedQuiz = JSON.parse(cleanedQuiz);

      if (
        !parsedQuiz ||
        !Array.isArray(parsedQuiz.questions)
      ) {
        throw new Error(
          "Invalid quiz structure. Missing questions array."
        );
      }
    } catch (error) {
      console.error(
        "[quiz-generator] Failed to parse AI response:",
        error
      );

      console.error(
        "[quiz-generator] Original AI output:"
      );
      console.error(quiz);

      return NextResponse.json(
        {
          error:
            "Invalid quiz format returned by AI",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      quiz: parsedQuiz,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "[quiz-generator] Request error:",
      errorMessage
    );

    return NextResponse.json(
      {
        error: `Failed to process request: ${errorMessage}`,
      },
      {
        status: 500,
      }
    );
  }
}