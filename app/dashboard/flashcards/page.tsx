"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getNextReview } from "@/lib/srs";

type Flashcard = {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  next_review: string;
  created_at: string;
};

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showAnswer, setShowAnswer] = useState(false);

  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const dueCards = useMemo(() => {
    const now = new Date();

    return cards.filter(
      (card) => new Date(card.next_review) <= now
    );
  }, [cards]);

  const current = dueCards[0];

  async function loadCards() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setCards(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function saveCard() {
    if (!question.trim() || !answer.trim()) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("flashcards")
        .update({
          question: question.trim(),
          answer: answer.trim(),
        })
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) console.error(error);
    } else {
      const { error } = await supabase
        .from("flashcards")
        .insert({
          user_id: user.id,
          question: question.trim(),
          answer: answer.trim(),
        });

      if (error) console.error(error);
    }

    setQuestion("");
    setAnswer("");
    setEditingId(null);
    setSaving(false);
    loadCards();
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setQuestion(card.question);
    setAnswer(card.answer);
  }

  async function deleteCard(id: string) {
    const { error } = await supabase
      .from("flashcards")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    loadCards();
  }

  async function generateFlashcards() {
    if (!aiContent.trim()) {
      setAiError("Please enter a topic or notes.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAiError("You must be logged in.");
        return;
      }

      const res = await fetch("/api/flashcard-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: aiContent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate flashcards");
      }

      const rows = data.flashcards.map(
        (card: { question: string; answer: string }) => ({
          user_id: user.id,
          question: card.question,
          answer: card.answer,
        })
      );

      const { error } = await supabase
        .from("flashcards")
        .insert(rows);

      if (error) throw error;

      setAiContent("");
      await loadCards();
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "Failed to generate flashcards"
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function reviewCard(rating: string) {
    if (!current) return;

    const { error } = await supabase
      .from("flashcards")
      .update({
        next_review: getNextReview(rating),
      })
      .eq("id", current.id);

    if (error) {
      console.error(error);
      return;
    }

    setShowAnswer(false);
    loadCards();
  }

  if (loading) {
    return <div className="p-6">Loading flashcards...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Flashcards
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Create, manage, and review your study flashcards.
        </p>
      </div>

      <div className="border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">
            Generate Flashcards with AI
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Paste notes or enter a topic to generate study flashcards automatically.
          </p>
        </div>

        <textarea
          value={aiContent}
          onChange={(e) => setAiContent(e.target.value)}
          placeholder="Paste study notes or enter a topic..."
          className="w-full border rounded-xl p-3 text-black"
          rows={5}
        />

        {aiError && (
          <p className="text-sm text-red-500">
            {aiError}
          </p>
        )}

        <button
          onClick={generateFlashcards}
          disabled={aiLoading || !aiContent.trim()}
          className="px-5 py-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50"
        >
          {aiLoading ? "Generating..." : "Generate Flashcards"}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border rounded-2xl p-5 space-y-4">
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Flashcard" : "Create Flashcard"}
          </h2>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter question..."
            className="w-full border rounded-xl p-3 text-black"
            rows={3}
          />

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter answer..."
            className="w-full border rounded-xl p-3 text-black"
            rows={4}
          />

          <div className="flex gap-3">
            <button
              onClick={saveCard}
              disabled={saving}
              className="px-5 py-2 bg-black text-white rounded-xl"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Card"
                  : "Create Card"}
            </button>

            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setQuestion("");
                  setAnswer("");
                }}
                className="px-5 py-2 border rounded-xl"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="border rounded-2xl p-5 space-y-4">
          <h2 className="text-xl font-semibold">
            Review Due Cards
          </h2>

          {!current ? (
            <div className="rounded-xl border border-dashed p-6">
              <h3 className="font-semibold">
                No flashcards due 🎉
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Create more cards or come back later for review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-xl p-5">
                <p className="text-sm text-gray-500 mb-2">
                  Question
                </p>
                <p className="font-medium">
                  {current.question}
                </p>

                {showAnswer && (
                  <>
                    <hr className="my-4" />
                    <p className="text-sm text-gray-500 mb-2">
                      Answer
                    </p>
                    <p>{current.answer}</p>
                  </>
                )}
              </div>

              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="px-5 py-2 border rounded-xl"
                >
                  Show Answer
                </button>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {["again", "hard", "good", "easy"].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => reviewCard(rating)}
                      className="px-4 py-2 border rounded-xl capitalize"
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">
            All Flashcards
          </h2>
        </div>

        {cards.length === 0 ? (
          <div className="p-6 text-gray-500">
            No flashcards created yet.
          </div>
        ) : (
          <div className="divide-y">
            {cards.map((card) => (
              <div
                key={card.id}
                className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <p className="font-semibold">
                    {card.question}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {card.answer}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(card)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteCard(card.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}