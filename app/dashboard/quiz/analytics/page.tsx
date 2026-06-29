"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Attempt {
  id: string;
  topic: string;
  percentage: number;
  created_at: string;
}

interface AnalyticsData {
  cards: {
    totalQuizzes: number;
    averageScore: number;
    bestScore: number;
    totalQuestions: number;
  };
  attempts: Attempt[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/quiz-analytics", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load analytics");
      }

      const result = await res.json();

      setData(result);
    } catch (error) {
      console.error(error);
    }
  };

  if (!data) {
    return (
      <div className="p-6">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">
        Quiz Analytics
      </h1>

      <div className="grid md:grid-cols-4 gap-4">

        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h3 className="text-slate-500">
            Total Quizzes
          </h3>

          <p className="text-3xl font-bold mt-2">
            {data.cards.totalQuizzes}
          </p>
        </div>

        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h3 className="text-slate-500">
            Average Score
          </h3>

          <p className="text-3xl font-bold mt-2">
            {data.cards.averageScore.toFixed(1)}%
          </p>
        </div>

        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h3 className="text-slate-500">
            Best Score
          </h3>

          <p className="text-3xl font-bold mt-2">
            {data.cards.bestScore.toFixed(1)}%
          </p>
        </div>

        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h3 className="text-slate-500">
            Total Questions
          </h3>

          <p className="text-3xl font-bold mt-2">
            {data.cards.totalQuestions}
          </p>
        </div>

      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">

        <h2 className="text-xl font-semibold mb-4">
          Performance Trend
        </h2>

        <ResponsiveContainer
          width="100%"
          height={350}
        >
          <LineChart data={data.attempts}>
            <XAxis dataKey="topic" />
            <YAxis />
            <Tooltip />

            <Line
              type="monotone"
              dataKey="percentage"
            />
          </LineChart>
        </ResponsiveContainer>

      </div>
    </div>
  );
}