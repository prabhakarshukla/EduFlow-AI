"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getNextReview } from "@/lib/srs";

export default function FlashcardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);

  async function loadCards() {
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .lte("next_review", new Date().toISOString());

    setCards(data || []);
  }

  useEffect(() => {
    loadCards();
  }, []);

  const current = cards[0];

  async function reviewCard(rating: string) {
    if (!current) return;

    await supabase
      .from("flashcards")
      .update({
        next_review: getNextReview(rating),
      })
      .eq("id", current.id);

    setShowAnswer(false);
    loadCards();
  }

  if (!current) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">
          No flashcards due 🎉
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      <h1 className="text-3xl font-bold">
        Flashcards
      </h1>

      <div className="border rounded-xl p-6">

        <h2 className="font-semibold mb-4">
          Question
        </h2>

        <p>{current.question}</p>

        {showAnswer && (
          <>
            <hr className="my-4" />
            <h2 className="font-semibold mb-2">
              Answer
            </h2>
            <p>{current.answer}</p>
          </>
        )}
      </div>

      {!showAnswer ? (
        <button
          onClick={() => setShowAnswer(true)}
          className="px-4 py-2 border rounded"
        >
          Show Answer
        </button>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => reviewCard("again")}>
            Again
          </button>

          <button onClick={() => reviewCard("hard")}>
            Hard
          </button>

          <button onClick={() => reviewCard("good")}>
            Good
          </button>

          <button onClick={() => reviewCard("easy")}>
            Easy
          </button>
        </div>
      )}
    </div>
  );
}