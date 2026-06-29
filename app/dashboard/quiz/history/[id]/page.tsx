"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QuizAnswer {
  id: string;
  question: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

interface QuizAttempt {
  id: string;
  topic: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
}

export default function QuizAttemptPage() {
  const params = useParams();
  const attemptId = params.id as string;

  const [attempt, setAttempt] =
    useState<QuizAttempt | null>(null);

  const [answers, setAnswers] = useState<
    QuizAnswer[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttemptDetails();
  }, []);

  const fetchAttemptDetails = async () => {
    try {
      const { data: attemptData, error: attemptError } =
        await supabase
          .from("quiz_attempts")
          .select("*")
          .eq("id", attemptId)
          .single();

      if (attemptError) {
        throw attemptError;
      }

      const { data: answersData, error: answersError } =
        await supabase
          .from("quiz_answers")
          .select("*")
          .eq("attempt_id", attemptId)
          .order("created_at", {
            ascending: true,
          });

      if (answersError) {
        throw answersError;
      }

      setAttempt(attemptData);
      setAnswers(answersData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        Loading attempt...
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="p-6">
        Attempt not found.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="border rounded-xl p-6">
        <h1 className="text-3xl font-bold">
          {attempt.topic}
        </h1>

        <div className="mt-4 space-y-2">
          <p>
            <strong>Score:</strong>{" "}
            {attempt.score}/
            {attempt.total_questions}
          </p>

          <p>
            <strong>Percentage:</strong>{" "}
            {attempt.percentage?.toFixed(2)}%
          </p>

          <p>
            <strong>Date:</strong>{" "}
            {new Date(
              attempt.created_at
            ).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {answers.map((answer, index) => (
          <div
            key={answer.id}
            className="border rounded-xl p-5"
          >
            <h3 className="font-semibold text-lg mb-4">
              Question {index + 1}
            </h3>

            <p className="mb-4">
              {answer.question}
            </p>

            <div className="space-y-2">
              <p>
                <strong>Your Answer:</strong>{" "}
                {answer.user_answer || "No answer"}
              </p>

              <p>
                <strong>Correct Answer:</strong>{" "}
                {answer.correct_answer}
              </p>

              <p
                className={`font-semibold ${
                  answer.is_correct
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {answer.is_correct
                  ? "✅ Correct"
                  : "❌ Incorrect"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}