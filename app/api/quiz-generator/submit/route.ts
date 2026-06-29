import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      topic,
      score,
      totalQuestions,
      answers,
    } = body;

    const percentage =
      (score / totalQuestions) * 100;

console.log("BODY:", body);

console.log("VALUES:", {
  userId,
  topic,
  score,
  totalQuestions,
  percentage,
});
console.log("INSERT DATA:", {
  user_id: userId,
  topic,
  score,
  total_questions: totalQuestions,
  percentage,
});
    const { data: attempt, error: attemptError } =
      await supabase
        .from("quiz_attempts")
        .insert({
          user_id: userId,
          topic,
          score,
          total_questions: totalQuestions,
          percentage,
        })
        .select()
        .single();

    if (attemptError) {
      throw attemptError;
    }

    const answerRows = answers.map((answer: any) => ({
      attempt_id: attempt.id,
      question: answer.question,
      user_answer: answer.userAnswer,
      correct_answer: answer.correctAnswer,
      is_correct: answer.isCorrect,
    }));

    const { error: answersError } =
      await supabase
        .from("quiz_answers")
        .insert(answerRows);

    if (answersError) {
      throw answersError;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}