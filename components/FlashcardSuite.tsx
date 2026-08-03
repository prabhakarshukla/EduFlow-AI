"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export interface FlashcardQuestion {
  type: "mcq" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string | boolean;
  explanation?: string;
}

export interface FlashcardAnswerSummary {
  question: string;
  userAnswer: string;
  correctAnswer: string | boolean;
  isCorrect: boolean;
}

export interface FlashcardSessionResult {
  score: number;
  totalQuestions: number;
  accuracy: number;
  answers: FlashcardAnswerSummary[];
  missedQuestions: FlashcardQuestion[];
  completedAt: string;
  storageKey: string;
}

interface FlashcardSuiteProps {
  questions: FlashcardQuestion[];
  title?: string;
  subtitle?: string;
  sessionLabel?: string;
  onSessionComplete?: (result: FlashcardSessionResult) => void;
}

interface PersistedFlashcardState {
  activeIndex: number;
  selectedAnswers: Record<number, string>;
  revealedIndices: Record<number, boolean>;
  completed: boolean;
  sessionMode: "all" | "missed";
  completionSummary?: {
    score: number;
    totalQuestions: number;
    accuracy: number;
    missedIndexes: number[];
    completedAt: string;
  };
}

const STORAGE_PREFIX = "eduflow_flashcard_suite";

const normalizeAnswer = (value: string | boolean) =>
  String(value).trim().toLowerCase();

const hashString = (value: string) => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
};

const buildQuestionSignature = (questions: FlashcardQuestion[]) =>
  questions
    .map((question) =>
      [
        question.type,
        question.question,
        question.options?.join("||") ?? "",
        String(question.correctAnswer),
        question.explanation ?? "",
      ].join("::"),
    )
    .join("__");

export default function FlashcardSuite({
  questions,
  title = "Interactive Flashcards",
  subtitle = "Tap a card to flip it, choose an answer, and keep your missed questions in local storage for quick revision.",
  sessionLabel,
  onSessionComplete,
}: FlashcardSuiteProps) {
  const storageKey = useMemo(() => {
    const signature = buildQuestionSignature(questions);
    const label = sessionLabel?.trim() || "session";

    return `${STORAGE_PREFIX}:${label}:${hashString(signature)}`;
  }, [questions, sessionLabel]);

  const [hydrated, setHydrated] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealedIndices, setRevealedIndices] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [sessionMode, setSessionMode] = useState<"all" | "missed">("all");
  const [completionSummary, setCompletionSummary] = useState<PersistedFlashcardState["completionSummary"]>();
  const [isSaved, setIsSaved] = useState(false);

  const visibleIndexes = useMemo(() => {
    if (sessionMode === "missed" && completionSummary?.missedIndexes.length) {
      return completionSummary.missedIndexes;
    }

    return questions.map((_, index) => index);
  }, [completionSummary?.missedIndexes, questions, sessionMode]);

  const effectiveIndex =
    visibleIndexes[
      Math.min(activeIndex, Math.max(visibleIndexes.length - 1, 0))
    ] ?? 0;
  const currentQuestion = questions[effectiveIndex];
  const currentAnswer = selectedAnswers[effectiveIndex] ?? "";
  const currentRevealed = revealedIndices[effectiveIndex] ?? false;

  const getQuestionResult = (question: FlashcardQuestion, answer: string) => {
    if (!answer.trim()) {
      return false;
    }

    return (
      normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer)
    );
  };

  const progressCount = Object.keys(selectedAnswers).filter((key) =>
    selectedAnswers[Number(key)]?.trim(),
  ).length;

  const completedCount = questions.filter((question, index) => {
    const answer = selectedAnswers[index] ?? "";
    return getQuestionResult(question, answer);
  }).length;

  const missedCount = questions.length - completedCount;
  const accuracy = questions.length
    ? Math.round((completedCount / questions.length) * 100)
    : 0;

  useEffect(() => {
    setHydrated(true);

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;

      const parsed = JSON.parse(saved) as PersistedFlashcardState;

      setActiveIndex(Math.max(0, parsed.activeIndex ?? 0));
      setSelectedAnswers(parsed.selectedAnswers ?? {});
      setRevealedIndices(parsed.revealedIndices ?? {});
      setCompleted(Boolean(parsed.completed));
      setSessionMode(parsed.sessionMode ?? "all");
      setCompletionSummary(parsed.completionSummary);
      setIsSaved(Boolean(parsed.completed));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;

    const state: PersistedFlashcardState = {
      activeIndex,
      selectedAnswers,
      revealedIndices,
      completed,
      sessionMode,
      completionSummary,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [
    activeIndex,
    completed,
    completionSummary,
    hydrated,
    revealedIndices,
    selectedAnswers,
    sessionMode,
    storageKey,
  ]);

  useEffect(() => {
    if (!visibleIndexes.length) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex > visibleIndexes.length - 1) {
      setActiveIndex(visibleIndexes.length - 1);
    }
  }, [activeIndex, visibleIndexes.length]);

  const selectAnswer = (questionIndex: number, value: string) => {
    setSelectedAnswers((previous) => ({
      ...previous,
      [questionIndex]: value,
    }));

    setRevealedIndices((previous) => ({
      ...previous,
      [questionIndex]: false,
    }));
    setIsSaved(false);
  };

  const toggleReveal = (questionIndex: number) => {
    setRevealedIndices((previous) => ({
      ...previous,
      [questionIndex]: !previous[questionIndex],
    }));
  };

  const goToCard = (direction: -1 | 1) => {
    setActiveIndex((previous) => {
      const nextIndex = previous + direction;

      if (nextIndex < 0) return 0;
      if (nextIndex > visibleIndexes.length - 1) return visibleIndexes.length - 1;

      return nextIndex;
    });
  };

  const finishSession = () => {
    const answers = questions.map((question, index) => {
      const userAnswer = selectedAnswers[index] ?? "";
      const isCorrect = getQuestionResult(question, userAnswer);

      return {
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
      } satisfies FlashcardAnswerSummary;
    });

    const score = answers.filter((answer) => answer.isCorrect).length;
    const missedIndexes = answers
      .map((answer, index) => (!answer.isCorrect ? index : null))
      .filter((value): value is number => value !== null);
    const missedQuestions = missedIndexes.map((index) => questions[index]);
    const completedAt = new Date().toISOString();
    const summary = {
      score,
      totalQuestions: questions.length,
      accuracy: questions.length ? Math.round((score / questions.length) * 100) : 0,
      missedIndexes,
      completedAt,
    };

    const state: PersistedFlashcardState = {
      activeIndex,
      selectedAnswers,
      revealedIndices,
      completed: true,
      sessionMode,
      completionSummary: summary,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(state));
    setCompleted(true);
    setCompletionSummary(summary);
    setIsSaved(true);

    onSessionComplete?.({
      score,
      totalQuestions: questions.length,
      accuracy: summary.accuracy,
      answers,
      missedQuestions,
      completedAt,
      storageKey,
    });
  };

  const resetSession = () => {
    setActiveIndex(0);
    setSelectedAnswers({});
    setRevealedIndices({});
    setCompleted(false);
    setSessionMode("all");
    setCompletionSummary(undefined);
    setIsSaved(false);
    window.localStorage.removeItem(storageKey);
  };

  const reviewMissedOnly = () => {
    if (!completionSummary?.missedIndexes.length) return;

    setSessionMode("missed");
    setActiveIndex(0);
  };

  const reviewAllCards = () => {
    setSessionMode("all");
    setActiveIndex(0);
  };

  if (!questions.length) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-white/70 shadow-2xl backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">Flashcard Suite</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">No questions available</h2>
        <p className="mt-2 text-sm text-white/60">
          Generate a quiz or supply a structured MCQ payload to start studying.
        </p>
      </div>
    );
  }

  const currentCorrect = currentQuestion
    ? getQuestionResult(currentQuestion, currentAnswer)
    : false;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_35%),linear-gradient(135deg,_#08111f_0%,_#0f172a_45%,_#1e293b_100%)] p-6 text-white shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
              Flashcard Suite
            </p>
            <div>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[28rem]">
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Progress
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {progressCount}/{questions.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Accuracy
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">{accuracy}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Missed
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">{missedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Saved
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {isSaved ? "Yes" : "Draft"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-400 transition-all duration-500"
            style={{
              width: `${questions.length ? (progressCount / questions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {visibleIndexes.length ? activeIndex + 1 : 0}
              </span>
              <span>
                Card {visibleIndexes.length ? activeIndex + 1 : 0} of {visibleIndexes.length || 0}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reviewAllCards}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  sessionMode === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All cards
              </button>
              <button
                type="button"
                onClick={reviewMissedOnly}
                disabled={!completionSummary?.missedIndexes.length}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  sessionMode === "missed"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Missed only
              </button>
            </div>
          </div>

          <div className="relative min-h-[28rem] rounded-[1.75rem] bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {currentQuestion ? (
                <motion.div
                  key={`${effectiveIndex}-${currentRevealed ? "back" : "front"}-${currentQuestion.question}`}
                  initial={{ opacity: 0, rotateY: currentRevealed ? -90 : 90, scale: 0.98 }}
                  animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                  exit={{ opacity: 0, rotateY: currentRevealed ? 90 : -90, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{ transformStyle: "preserve-3d", perspective: 1400 }}
                  className="h-full"
                >
                  <div className="h-full rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                          {completed ? "Review mode" : "Study mode"}
                        </p>
                        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                          {currentQuestion.question}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleReveal(effectiveIndex)}
                        className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        {currentRevealed ? "Hide answer" : "Flip card"}
                      </button>
                    </div>

                    <div className="mt-6 space-y-3">
                      {currentQuestion.type === "mcq" && currentQuestion.options?.length ? (
                        currentQuestion.options.map((option, optionIndex) => {
                          const isSelected = currentAnswer === option;
                          const isCorrectOption =
                            currentRevealed &&
                            normalizeAnswer(option) === normalizeAnswer(currentQuestion.correctAnswer);
                          const isWrongSelection = currentRevealed && isSelected && !isCorrectOption;

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectAnswer(effectiveIndex, option);
                              }}
                              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                                isCorrectOption
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm"
                                  : isWrongSelection
                                    ? "border-rose-300 bg-rose-50 text-rose-900 shadow-sm"
                                    : isSelected
                                      ? "border-sky-400 bg-sky-50 text-sky-950 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                  isCorrectOption
                                    ? "bg-emerald-600 text-white"
                                    : isWrongSelection
                                      ? "bg-rose-600 text-white"
                                      : isSelected
                                        ? "bg-sky-600 text-white"
                                        : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {String.fromCharCode(65 + optionIndex)}
                              </span>
                              <span className="text-sm font-medium leading-6">{option}</span>
                            </button>
                          );
                        })
                      ) : currentQuestion.type === "true_false" ? (
                        ["true", "false"].map((option) => {
                          const isSelected = currentAnswer === option;
                          const isCorrectOption =
                            currentRevealed &&
                            normalizeAnswer(option) === normalizeAnswer(currentQuestion.correctAnswer);
                          const isWrongSelection = currentRevealed && isSelected && !isCorrectOption;

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectAnswer(effectiveIndex, option);
                              }}
                              className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition-all duration-200 ${
                                isCorrectOption
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : isWrongSelection
                                    ? "border-rose-300 bg-rose-50 text-rose-900"
                                    : isSelected
                                      ? "border-sky-400 bg-sky-50 text-sky-950"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            rows={5}
                            value={currentAnswer}
                            onChange={(event) => selectAnswer(effectiveIndex, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            placeholder="Type your answer here..."
                            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                          />

                          {currentRevealed ? (
                            <div
                              className={`rounded-2xl border px-4 py-3 text-sm ${
                                currentCorrect
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                  : "border-rose-200 bg-rose-50 text-rose-900"
                              }`}
                            >
                              <p className="font-semibold">
                                {currentCorrect ? "Correct response" : "Expected response"}
                              </p>
                              <p className="mt-1 leading-6">
                                {String(currentQuestion.correctAnswer)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p>
                          {currentRevealed
                            ? currentCorrect
                              ? "Correct answer revealed."
                              : "Answer revealed. Review the explanation and keep the missed card in your revision deck."
                            : "Choose an answer, then flip the card to compare your response."}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleReveal(effectiveIndex)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          {currentRevealed ? "Hide" : "Reveal"}
                        </button>
                      </div>

                      {currentRevealed && currentQuestion.explanation ? (
                        <div className="mt-3 rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-700">
                          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-500">
                            Explanation
                          </p>
                          <p className="mt-1 leading-6">{currentQuestion.explanation}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToCard(-1)}
              disabled={!visibleIndexes.length || activeIndex === 0}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                {sessionMode === "missed" ? "Reviewing missed cards" : "Reviewing all cards"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => goToCard(1)}
              disabled={!visibleIndexes.length || activeIndex >= visibleIndexes.length - 1}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <aside className="space-y-4 rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Session controls
            </p>
            <h3 className="mt-2 text-lg font-bold text-slate-950">Track your study state</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Progress, answer choices, and review mode are automatically saved in local storage for this exact quiz payload.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                Summary
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Answered</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-950">{progressCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Correct</dt>
                  <dd className="mt-1 text-lg font-bold text-emerald-600">{completedCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Missed</dt>
                  <dd className="mt-1 text-lg font-bold text-rose-600">{missedCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Accuracy</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-950">{accuracy}%</dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              onClick={finishSession}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Save session
            </button>

            <button
              type="button"
              onClick={resetSession}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset session
            </button>
          </div>

          <AnimatePresence>
            {completed && completionSummary ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
              >
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">
                  Saved result
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                  Your flashcard session is cached locally and ready for quick revision. {completionSummary.missedIndexes.length ? `${completionSummary.missedIndexes.length} questions were saved for another pass.` : "No misses were recorded on this run."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={reviewMissedOnly}
                    disabled={!completionSummary.missedIndexes.length}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Review missed
                  </button>
                  <button
                    type="button"
                    onClick={reviewAllCards}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Review all
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}