"use client";

import { useState } from "react";
import FlashcardSuite, {
  type FlashcardQuestion,
  type FlashcardSessionResult,
} from "@/components/FlashcardSuite";
import { supabase } from "@/lib/supabase";

interface QuizData {
  questions: FlashcardQuestion[];
}

export default function QuizPage() {
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState<"topic" | "notes">("topic");

  const generateQuiz = async () => {
    try {
      setLoading(true);
      setError("");
      setQuiz(null);

      const formData = new FormData();
      if (inputType === "topic") {
        formData.append("topic", topic);
      } else if (inputType === "notes" && file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/quiz-generator", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate quiz");
      }

      setQuiz(data.quiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSessionComplete = async (result: FlashcardSessionResult) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      await fetch("/api/quiz-generator/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          topic: inputType === "topic" ? topic : `Notes: ${file?.name}`,
          score: result.score,
          totalQuestions: result.totalQuestions,
          answers: result.answers,
        }),
      });
    } catch (error) {
      console.error("Failed to save quiz results:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 text-gray-800 antialiased">
      {/* Header Section */}
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          AI Quiz Generator
        </h1>
        <p className="text-lg text-gray-500 mt-2">
          Instantly transform broad study topics or text notes into interactive assessments.
        </p>
      </div>

      {/* Configuration Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Toggle Controls */}
        <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200 p-2 gap-2">
          <button
            type="button"
            onClick={() => setInputType("topic")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 ${
              inputType === "topic"
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/60"
            }`}
          >
            <span className="text-base">📘</span> Topic Input
          </button>
          <button
            type="button"
            onClick={() => setInputType("notes")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 ${
              inputType === "notes"
                ? "bg-white text-emerald-600 shadow-sm ring-1 ring-black/5"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/60"
            }`}
          >
            <span className="text-base">📄</span> Upload Notes
          </button>
        </div>

        {/* Active Input Content Wrapper */}
        <div className="p-6">
          {inputType === "topic" ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Enter Study Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., React Hooks, Binary Search Trees, Cell Mitosis"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Study Notes Source
              </label>
              <div className="group relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 text-center transition-colors hover:bg-gray-100/70 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-1 pointer-events-none">
                  <span className="inline-block text-3xl mb-1">📄</span>
                  <p className="text-sm font-medium text-gray-700">
                    {file ? "Change selected file" : "Click to select or drag text file here"}
                  </p>
                  <p className="text-xs text-gray-400">Accepts plain text (.txt) files</p>
                </div>
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 font-medium animate-fadeIn">
                  <span>✅</span>
                  <span className="truncate">{file.name}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Core Trigger Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={generateQuiz}
              disabled={
                loading ||
                (inputType === "topic" && !topic.trim()) ||
                (inputType === "notes" && !file)
              }
              className="w-full sm:w-auto px-6 py-3 bg-gray-900 text-white rounded-xl font-medium shadow-sm hover:bg-gray-800 active:bg-gray-950 focus:outline-none focus:ring-4 focus:ring-gray-900/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Generating Evaluation..." : "Generate Quiz"}
            </button>
          </div>
        </div>
      </div>

      {quiz && (
        <FlashcardSuite
          questions={quiz.questions}
          title="AI Quiz Generator"
          subtitle="Study the generated questions as interactive flashcards. Flip to reveal answers, save your missed cards, and keep your progress in local storage."
          sessionLabel={inputType === "topic" ? topic : file?.name ?? "uploaded-notes"}
          onSessionComplete={handleSessionComplete}
        />
      )}
    </div>
  );
}