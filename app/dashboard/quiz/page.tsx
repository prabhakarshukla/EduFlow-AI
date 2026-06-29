"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Question {
  type: "mcq" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string | boolean;
  explanation?: string;
}

interface QuizData {
  questions: Question[];
}

export default function QuizPage() {
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState<"topic" | "notes">("topic");

  const generateQuiz = async () => {
    try {
      setLoading(true);
      setError("");
      setQuiz(null);
      setSubmitted(false);
      setAnswers({});

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

  const handleAnswer = (index: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const submitQuiz = async () => {
    if (!quiz) return;

    let correct = 0;
    const answerData = quiz.questions.map((question, index) => {
      const userAnswer = answers[index] || "";
      const isCorrect =
        String(userAnswer).trim().toLowerCase() ===
        String(question.correctAnswer).trim().toLowerCase();

      if (isCorrect) correct++;

      return {
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
      };
    });

    setScore(correct);
    setSubmitted(true);

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
          score: correct,
          totalQuestions: quiz.questions.length,
          answers: answerData,
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

      {/* Quiz Delivery Layout */}
      {quiz && (
        <div className="space-y-6 animate-fadeIn">
          {quiz.questions.map((question: Question, index: number) => {
            const currentSelection = answers[index] || "";
            const isAnswered = currentSelection !== "";

            return (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-4"
              >
                <div className="flex gap-3 items-start">
                  <span className="flex items-center justify-center shrink-0 w-7 h-7 bg-gray-100 text-gray-700 font-bold text-xs rounded-lg mt-0.5">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold text-gray-900 text-base md:text-lg leading-snug">
                    {question.question}
                  </h3>
                </div>

                {/* Question Option Context Parsers */}
                {question.type === "mcq" && (
                  <div className="grid grid-cols-1 gap-2.5 pl-0 sm:pl-10">
                    {question.options?.map((option: string, optionIndex: number) => {
                      const isSelected = currentSelection === option;
                      return (
                        <label
                          key={optionIndex}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/50 text-blue-900 font-medium"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 text-gray-700"
                          } ${submitted ? "pointer-events-none opacity-80" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={option}
                            checked={isSelected}
                            disabled={submitted}
                            onChange={(e) => handleAnswer(index, e.target.value)}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500/20"
                          />
                          <span className="text-sm">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {question.type === "true_false" && (
                  <div className="grid grid-cols-2 gap-3 pl-0 sm:pl-10 max-w-sm">
                    {["true", "false"].map((val) => {
                      const isSelected = currentSelection === val;
                      return (
                        <label
                          key={val}
                          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border capitalize cursor-pointer transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/50 text-blue-900 font-medium"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 text-gray-700"
                          } ${submitted ? "pointer-events-none opacity-80" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={val}
                            checked={isSelected}
                            disabled={submitted}
                            onChange={(e) => handleAnswer(index, e.target.value)}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500/20"
                          />
                          <span className="text-sm">{val}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {question.type === "short_answer" && (
                  <div className="pl-0 sm:pl-10">
                    <textarea
                      rows={3}
                      value={currentSelection}
                      disabled={submitted}
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Type your structured answer here..."
                      onChange={(e) => handleAnswer(index, e.target.value)}
                    />
                  </div>
                )}

                {/* Inline Explanations and Dynamic Corrections */}
                {submitted && (
                  <div className="mt-4 pt-4 border-t border-gray-100 pl-0 sm:pl-10 space-y-3 animate-fadeIn">
                    {String(currentSelection).trim().toLowerCase() ===
                    String(question.correctAnswer).trim().toLowerCase() ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                        <span>✅</span> Correct Answer
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                        <span>❌</span> Incorrect Answer
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Your Response
                        </p>
                        <p className="mt-1 text-sm text-gray-800 font-medium">
                          {currentSelection || <span className="text-gray-400 italic">Left blank</span>}
                        </p>
                      </div>

                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">
                          Expected Answer
                        </p>
                        <p className="mt-1 text-sm text-emerald-900 font-semibold">
                          {String(question.correctAnswer)}
                        </p>
                      </div>
                    </div>

                    {question.explanation && (
                      <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5 text-sm">
                        <p className="font-semibold text-blue-900">Explanation</p>
                        <p className="mt-1 text-blue-900/80 leading-relaxed">
                          {question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submission and Scoring Triggers */}
          <div className="pt-2">
            {!submitted ? (
              <button
                onClick={submitQuiz}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 text-white rounded-xl font-semibold shadow-sm hover:bg-emerald-500 active:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 transition-all"
              >
                Submit Quiz Answers
              </button>
            ) : (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-scaleUp">
                <div>
                  <h2 className="text-xl font-bold">Quiz Performance Completed</h2>
                  <p className="text-emerald-100 text-sm mt-0.5">
                    Your answers were graded and synchronized to your account profile data dashboard safely.
                  </p>
                </div>
                <div className="bg-white/15 px-6 py-3 rounded-xl border border-white/10 shrink-0 text-center sm:text-right">
                  <span className="text-xs block text-emerald-200 font-bold uppercase tracking-wider">Final Score</span>
                  <span className="text-3xl font-black tabular-nums">
                    {score} <span className="text-xl font-medium opacity-70">/ {quiz.questions.length}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}