"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function QuizAttemptPage() {
  const params = useParams();

  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttempt();
  }, []);

  const fetchAttempt = async () => {
    try {
      const { data, error } =
        await supabase
          .from("quiz_answers")
          .select("*")
          .eq("attempt_id", params.id);

      if (error) throw error;

      setAnswers(data || []);
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">
        Quiz Review
      </h1>

      {answers.map((answer, index) => (
        <div
          key={answer.id}
          className={`border rounded-xl p-4 ${
            answer.is_correct
              ? "bg-green-50"
              : "bg-red-50"
          }`}
        >
          <h3 className="font-semibold mb-3">
            {index + 1}. {answer.question}
          </h3>

          <p>
            <strong>Your Answer:</strong>{" "}
            {answer.user_answer || "No Answer"}
          </p>

          <p className="mt-2">
            <strong>Correct Answer:</strong>{" "}
            {answer.correct_answer}
          </p>

          <p
            className={`mt-3 font-medium ${
              answer.is_correct
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {answer.is_correct
              ? "Correct"
              : "Incorrect"}
          </p>
        </div>
      ))}
    </div>
  );
}