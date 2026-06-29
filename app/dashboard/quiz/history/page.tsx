"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function QuizHistoryPage() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      setAttempts(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const averageScore =
    attempts.length > 0
      ? (
          attempts.reduce(
            (sum, item) => sum + item.percentage,
            0
          ) / attempts.length
        ).toFixed(1)
      : 0;

  const highestScore =
    attempts.length > 0
      ? Math.max(
          ...attempts.map(
            (item) => item.percentage
          )
        )
      : 0;

  if (loading) {
    return (
      <div className="p-6">
        Loading history...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <h1 className="text-3xl font-bold text-white">
      Quiz History
    </h1>

    <p className="text-gray-500 mt-1">
      View your previous quiz attempts and track your learning progress.
    </p>
  </div>

  <Link
    href="/dashboard/quiz/analytics"
    className="
      inline-flex
      items-center
      justify-center
      px-5
      py-3
      bg-black
      text-white
      rounded-xl
      font-medium
      shadow-sm
      hover:shadow-md
      hover:scale-[1.02]
      transition-all
    "
  >
    📊 View Analytics
  </Link>
</div>

     
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-blue">
            <tr>
              <th className="p-3 text-left">
                Topic
              </th>
              <th className="p-3 text-left">
                Score
              </th>
              <th className="p-3 text-left">
                Percentage
              </th>
              <th className="p-3 text-left">
                Date
              </th>
              <th className="p-3 text-left">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {attempts.map((attempt) => (
              <tr
                key={attempt.id}
                className="border-t"
              >
                <td className="p-3">
                  {attempt.topic}
                </td>

                <td className="p-3">
                  {attempt.score}/
                  {attempt.total_questions}
                </td>

                <td className="p-3">
                  {Number(attempt.percentage ?? 0).toFixed(1)}%
                </td>

                <td className="p-3">
                  {new Date(
                    attempt.created_at
                  ).toLocaleDateString()}
                </td>
                  
                <td className="p-3">
                  <Link
                    href={`/dashboard/quiz/attempt/${attempt.id}`}
                    className="text-blue-600"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}