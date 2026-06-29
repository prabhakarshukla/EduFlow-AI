"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { captureEvent } from "@/lib/posthog/helpers";
import { EVENTS } from "@/lib/posthog/events";

type MoodEntry = {
  id: string;
  mood: number;
  note: string | null;
  occurred_at: string;
};

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl p-6 transition-all duration-200 ${className}`}
      style={{
        background: "var(--ui-surface)",
        border: "1px solid var(--ui-border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-widest mb-4"
      style={{ color: "var(--ui-muted)" }}
    >
      {children}
    </p>
  );
}

const moodMeta: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Rough", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  2: { label: "Low", color: "#fb7185", bg: "rgba(251,113,133,0.10)" },
  3: { label: "Okay", color: "#fbbf24", bg: "rgba(245,158,11,0.12)" },
  4: { label: "Good", color: "#6EE7D8", bg: "rgba(110,231,216,0.10)" },
  5: { label: "Great", color: "#14B8A6", bg: "rgba(20,184,166,0.12)" },
};

const moodEmoji: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😁",
};

const uiTransition = "all 0.22s ease-in-out";

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function MoodTrackerPage() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mood, setMood] = useState<number>(4);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>("");

  const [suggestionMood, setSuggestionMood] = useState<
    "tired" | "neutral" | "motivated"
  >("neutral");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionTyping, setSuggestionTyping] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const todaysAvg = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const todays = entries.filter((e) => {
      const t = new Date(e.occurred_at);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    });
    if (!todays.length) return null;
    const avg = todays.reduce((sum, e) => sum + e.mood, 0) / todays.length;
    return Math.round(avg * 10) / 10;
  }, [entries]);

  const todayLatestEntry = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    return (
      entries.find((e) => {
        const t = new Date(e.occurred_at);
        return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
      }) ?? null
    );
  }, [entries]);

  const loadEntries = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("mood_entries")
        .select("id,mood,note,occurred_at")
        .order("occurred_at", { ascending: false });

      if (qErr) {
        setError(qErr.message);
        setEntries([]);
        return;
      }
      setEntries(
        (data ?? []).map((r: any) => ({
          id: String(r.id),
          mood: Number(r.mood),
          note: (r.note ?? null) as string | null,
          occurred_at: String(r.occurred_at),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mood history.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: uErr } = await supabase.auth.getUser();
      if (!alive) return;
      if (uErr) setError(uErr.message);
      if (data.user) await loadEntries();
      else setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const addEntry = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) {
        setError("You need to be logged in to add mood entries.");
        return;
      }

      const iso = occurredAt
        ? new Date(occurredAt).toISOString()
        : new Date().toISOString();

      const { error: insErr } = await supabase.from("mood_entries").insert({
        user_id: user.id,
        mood,
        note: note.trim() || null,
        occurred_at: iso,
      });

      if (insErr) {
        setError(insErr.message ?? "Failed to save mood entry.");
        return;
      }

      captureEvent(EVENTS.MOOD_LOGGED, { mood_value: mood, has_note: !!note.trim() });
      setSuccess("Saved.");
      setNote("");
      setOccurredAt("");
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save mood entry.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSuccess(null), 1400);
    }
  };

  const deleteEntry = async (id: string) => {
    setError(null);
    const prev = entries;
    setEntries((es) => es.filter((e) => e.id !== id));
    try {
      const { error: delErr } = await supabase
        .from("mood_entries")
        .delete()
        .eq("id", id);
      if (delErr) {
        setEntries(prev);
        setError(delErr.message);
      } else {
        captureEvent(EVENTS.MOOD_ENTRY_DELETED);
      }
    } catch (e) {
      setEntries(prev);
      setError(e instanceof Error ? e.message : "Failed to delete entry.");
    }
  };

  const updateNote = async (id: string, newNote: string) => {
    setError(null);
    const prev = entries;
    setEntries((es) =>
      es.map((e) => (e.id === id ? { ...e, note: newNote.trim() || null } : e)),
    );
    try {
      const { error: upErr } = await supabase
        .from("mood_entries")
        .update({ note: newNote.trim() || null })
        .eq("id", id);
      if (upErr) {
        setEntries(prev);
        setError(upErr.message);
      }
    } catch (e) {
      setEntries(prev);
      setError(e instanceof Error ? e.message : "Failed to update entry.");
    }
  };

  const getSuggestion = async () => {
    setSuggestionsError(null);
    setSuggestion("Thinking...");
    setSuggestionTyping(false);
    setSuggestionsLoading(true);
    try {
      const res = await fetch("/api/doubt-solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: "mood",
          userMessage: "Give study advice based on my current mood",
          context: {
            mood: suggestionMood,
            recentTasks: entries
              .filter((e) => {
                const d = new Date(e.occurred_at);
                const today = new Date();
                return d.toDateString() === today.toDateString();
              })
              .slice(0, 2)
              .map((e) => e.note)
              .filter((n): n is string => !!n),
          },
        }),
      });

      const data = (await res.json()) as {
        response?: string;
        suggestion?: string;
        answer?: string;
        error?: string;
      };

      if (!res.ok) {
        setSuggestionsError(data?.error || "Failed to get suggestions.");
        return;
      }

      const aiResponse =
        data.response || data.suggestion || data.answer || null;
      if (!aiResponse?.trim()) {
        setSuggestionsError("AI returned an empty suggestion.");
        setSuggestion(null);
        return;
      }

      const suggestionText = aiResponse.trim();
      captureEvent(EVENTS.MOOD_SUGGESTION_REQUESTED, { mood_state: suggestionMood });
      setSuggestion("");
      setSuggestionTyping(true);

      let index = 0;
      const chunkSize = 4;
      const timer = window.setInterval(() => {
        index += chunkSize;
        setSuggestion(suggestionText.slice(0, index));

        if (index >= suggestionText.length) {
          window.clearInterval(timer);
          setSuggestionTyping(false);
        }
      }, 12);
    } catch (e) {
      setSuggestionsError(
        e instanceof Error ? e.message : "Failed to get suggestions.",
      );
      setSuggestion(null);
      setSuggestionTyping(false);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-3"
            style={{
              background: "rgba(110,231,216,0.08)",
              color: "#6EE7D8",
              border: "1px solid rgba(110,231,216,0.18)",
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Mood Tracker
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--ui-heading)" }}
          >
            Check in. Stay balanced.
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--ui-muted)" }}>
            Log your mood in seconds and spot patterns over time.
          </p>
        </div>

        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl flex-shrink-0"
          style={{
            background: "var(--ui-surface)",
            border: "1px solid rgba(110,231,216,0.15)",
          }}
        >
          <svg
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "#6EE7D8" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--ui-heading)" }}
          >
            {todaysAvg ? `Today avg: ${todaysAvg}/5` : "Today avg: —"}
          </span>
        </div>
      </div>

      <Card
        className="p-5 sm:p-6"
        style={
          {
            background:
              "linear-gradient(135deg, var(--ui-surface), var(--ui-surface-2))",
            border: "1px solid var(--ui-border)",
            boxShadow: "0 10px 24px rgba(31,41,55,0.08)",
          } as React.CSSProperties
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--ui-muted)" }}
            >
              Today&apos;s Mood
            </p>
            {todayLatestEntry ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-lg">
                  {moodEmoji[todayLatestEntry.mood] ?? "🙂"}
                </span>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--ui-heading)" }}
                >
                  {moodMeta[todayLatestEntry.mood]?.label ?? "Logged"} (
                  {todayLatestEntry.mood}/5)
                </p>
              </div>
            ) : (
              <p
                className="text-sm mt-1.5"
                style={{ color: "var(--ui-muted)" }}
              >
                No mood saved today yet.
              </p>
            )}
          </div>
          {todayLatestEntry?.note ? (
            <p
              className="text-xs sm:text-sm max-w-xl rounded-xl px-3 py-2.5"
              style={{
                color: "var(--ui-muted)",
                background: "rgba(110,231,216,0.07)",
                border: "1px solid rgba(110,231,216,0.20)",
              }}
            >
              {todayLatestEntry.note}
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 flex flex-col gap-5">
          <SectionLabel>Quick Check-in</SectionLabel>

          {error && (
            <div
              className="rounded-xl px-3 py-2.5 text-sm"
              role="alert"
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.30)",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="rounded-xl px-3 py-2.5 text-sm"
              role="status"
              style={{
                background: "rgba(110,231,216,0.14)",
                border: "1px solid rgba(110,231,216,0.30)",
                color: "var(--ui-heading)",
              }}
            >
              {success}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5].map((v) => {
              const meta = moodMeta[v];
              const active = mood === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMood(v)}
                  className="rounded-xl px-3 py-3 text-left transition-all duration-200"
                  style={{
                    background: active
                      ? `linear-gradient(135deg, ${meta.bg}, rgba(110,231,216,0.08))`
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(110,231,216,0.45)" : "rgba(110,231,216,0.14)"}`,
                    color: active ? "var(--ui-heading)" : "var(--ui-muted)",
                    boxShadow: active
                      ? "0 0 0 2px rgba(110,231,216,0.14), 0 10px 20px rgba(110,231,216,0.12)"
                      : "0 2px 8px rgba(0,0,0,0.10)",
                    transform: active
                      ? "translateY(-1px) scale(1.015)"
                      : "translateY(0) scale(1)",
                    transition: uiTransition,
                  }}
                  title={meta.label}
                  aria-pressed={active}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(110,231,216,0.28)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 8px 16px rgba(110,231,216,0.10)";
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-1px) scale(1.01)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(110,231,216,0.14)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 2px 8px rgba(0,0,0,0.10)";
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0) scale(1)";
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0) scale(0.995)";
                  }}
                  onMouseUp={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-1px) scale(1.01)";
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base leading-none">
                      {moodEmoji[v]}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: active
                          ? "rgba(110,231,216,0.18)"
                          : "rgba(255,255,255,0.06)",
                        color: active ? "#0d9488" : "var(--ui-subtle)",
                      }}
                    >
                      {v}/5
                    </span>
                  </div>
                  <p
                    className="mt-2 text-xs font-semibold"
                    style={{
                      color: active ? "var(--ui-heading)" : "var(--ui-muted)",
                    }}
                  >
                    {meta.label}
                  </p>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-xl px-3 py-2.5"
            style={{
              background: "var(--ui-surface-2)",
              border: "1px solid var(--ui-border)",
            }}
          >
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--ui-heading)" }}
            >
              {moodMeta[mood].label}
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--ui-muted)" }}
            >
              Add a quick note (optional) — what influenced today?
            </p>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Slept well, finished tasks, felt focused…"
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{
              minHeight: "110px",
              resize: "none",
              background: "var(--ui-surface)",
              border: "1px solid rgba(110,231,216,0.15)",
              color: "var(--ui-heading)",
              outline: "none",
            }}
          />

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--ui-heading)" }}
            >
              Time (optional)
            </label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="rounded-xl px-3 py-2.5 text-sm w-full"
              style={{
                background: "var(--ui-surface)",
                border: "1px solid rgba(110,231,216,0.15)",
                color: "var(--ui-heading)",
                outline: "none",
              }}
            />
          </div>

          <button
            type="button"
            onClick={addEntry}
            disabled={saving}
            className="mt-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: saving
                ? "rgba(255,255,255,0.06)"
                : "linear-gradient(135deg,#6EE7D8,#14B8A6)",
              color: saving ? "var(--ui-subtle)" : "#111827",
              boxShadow: saving ? "none" : "0 4px 16px rgba(110,231,216,0.28)",
              opacity: saving ? 0.85 : 1,
              cursor: saving ? "not-allowed" : "pointer",
              transition: uiTransition,
            }}
            onMouseEnter={(e) => {
              if (!saving)
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 6px 20px rgba(110,231,216,0.34)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = saving
                ? "none"
                : "0 4px 16px rgba(110,231,216,0.28)";
            }}
            onMouseDown={(e) => {
              if (!saving)
                (e.currentTarget as HTMLElement).style.transform =
                  "scale(0.99)";
            }}
            onMouseUp={(e) => {
              if (!saving)
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {saving ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Save check-in
              </>
            )}
          </button>
        </Card>

        <Card className="lg:col-span-1">
          <SectionLabel>AI Mood-Based Suggestions</SectionLabel>

          {suggestionsError && (
            <div
              className="rounded-xl px-3 py-2.5 text-sm mb-4"
              role="alert"
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.30)",
                color: "#b91c1c",
              }}
            >
              {suggestionsError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p
                className="text-xs font-semibold mb-2.5"
                style={{ color: "var(--ui-heading)" }}
              >
                How are you feeling?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {["tired", "neutral", "motivated"].map((m) => {
                  const active = suggestionMood === m;
                  const moodEmojis: Record<string, string> = {
                    tired: "😴",
                    neutral: "😐",
                    motivated: "🚀",
                  };
                  const moodColors: Record<string, string> = {
                    tired: "#f87171",
                    neutral: "#fbbf24",
                    motivated: "#10b981",
                  };
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setSuggestionMood(m as typeof suggestionMood)
                      }
                      className="rounded-xl px-2.5 py-2.5 text-center transition-all duration-200 text-sm font-semibold capitalize"
                      style={{
                        background: active
                          ? `linear-gradient(135deg, ${moodColors[m]}22, ${moodColors[m]}11)`
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? `${moodColors[m]}40` : "rgba(110,231,216,0.14)"}`,
                        color: active ? moodColors[m] : "var(--ui-muted)",
                        boxShadow: active
                          ? `0 0 12px ${moodColors[m]}20`
                          : "none",
                        transition: uiTransition,
                      }}
                      aria-pressed={active}
                    >
                      <div className="text-base mb-1">{moodEmojis[m]}</div>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={getSuggestion}
              disabled={suggestionsLoading || suggestionTyping}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: suggestionsLoading || suggestionTyping
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(135deg,#6EE7D8,#14B8A6)",
                color:
                  suggestionsLoading || suggestionTyping
                    ? "var(--ui-subtle)"
                    : "#111827",
                boxShadow: suggestionsLoading || suggestionTyping
                  ? "none"
                  : "0 4px 16px rgba(110,231,216,0.28)",
                opacity: suggestionsLoading || suggestionTyping ? 0.85 : 1,
                cursor:
                  suggestionsLoading || suggestionTyping
                    ? "not-allowed"
                    : "pointer",
                transition: uiTransition,
              }}
              onMouseEnter={(e) => {
                if (!suggestionsLoading && !suggestionTyping)
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 6px 20px rgba(110,231,216,0.34)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  suggestionsLoading || suggestionTyping
                    ? "none"
                    : "0 4px 16px rgba(110,231,216,0.28)";
              }}
              onMouseDown={(e) => {
                if (!suggestionsLoading && !suggestionTyping)
                  (e.currentTarget as HTMLElement).style.transform =
                    "scale(0.99)";
              }}
              onMouseUp={(e) => {
                if (!suggestionsLoading && !suggestionTyping)
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              {suggestionsLoading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Thinking...
                </>
              ) : suggestionTyping ? (
                <>Typing suggestion...</>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Get Study Suggestion
                </>
              )}
            </button>

            {suggestionsLoading && (
              <div
                className="rounded-xl p-3 space-y-2"
                style={{
                  background: "rgba(110,231,216,0.06)",
                  border: "1px solid rgba(110,231,216,0.18)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "#0f766e" }}>
                  Thinking...
                </p>
                {["100%", "84%", "62%"].map((width) => (
                  <div
                    key={width}
                    className="h-2.5 rounded-lg animate-pulse"
                    style={{ width, background: "rgba(110,231,216,0.18)" }}
                  />
                ))}
              </div>
            )}

            {suggestion && (
              <div
                className="rounded-xl px-3.5 py-3 text-sm"
                style={{
                  background: "rgba(110,231,216,0.08)",
                  border: "1px solid rgba(110,231,216,0.25)",
                  color: "var(--ui-text)",
                  lineHeight: "1.6",
                }}
              >
                <p
                  className="font-semibold mb-2"
                  style={{ color: "var(--ui-heading)" }}
                >
                  ✨ Your personalized suggestion:
                </p>
                <p>
                  {suggestion}
                  {suggestionTyping && <span className="animate-pulse">|</span>}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <SectionLabel>Mood History</SectionLabel>
              <p
                className="text-sm font-semibold -mt-2"
                style={{ color: "var(--ui-heading)" }}
              >
                {entries.length} check-in{entries.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={loadEntries}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: "var(--ui-surface-2)",
                border: "1px solid var(--ui-border)",
                color: "var(--ui-text)",
                transition: uiTransition,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.28)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(110,231,216,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.12)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.04)";
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  "scale(0.99)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2.5">
            {loading && (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 animate-pulse"
                    style={{
                      background: "var(--ui-surface-2)",
                      border: "1px solid var(--ui-border)",
                    }}
                  >
                    <div
                      className="h-3 w-32 rounded mb-2"
                      style={{ background: "rgba(255,255,255,0.10)" }}
                    />
                    <div
                      className="h-3 w-full rounded"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    />
                  </div>
                ))}
              </>
            )}

            {!loading && entries.length === 0 && !error && (
              <div
                className="rounded-xl p-6 text-center"
                style={{
                  background: "rgba(110,231,216,0.06)",
                  border: "1px dashed rgba(110,231,216,0.22)",
                }}
              >
                <p className="text-lg mb-2">🧠</p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--ui-heading)" }}
                >
                  No mood check-ins yet
                </p>
                <p
                  className="text-[11px] mt-1.5"
                  style={{ color: "var(--ui-muted)" }}
                >
                  Start tracking how you feel each day to build better study
                  habits.
                </p>
              </div>
            )}

            {!loading &&
              entries.map((e) => {
                const meta = moodMeta[e.mood] ?? moodMeta[3];
                return (
                  <div
                    key={e.id}
                    className="group flex items-start gap-4 p-4 rounded-xl transition-all duration-200"
                    style={{
                      background: "var(--ui-surface-2)",
                      border: "1px solid var(--ui-border)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
                      transition: uiTransition,
                    }}
                    onMouseEnter={(ev) => {
                      (ev.currentTarget as HTMLElement).style.borderColor =
                        "rgba(110,231,216,0.28)";
                      (ev.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.05)";
                      (ev.currentTarget as HTMLElement).style.transform =
                        "translateY(-1px)";
                    }}
                    onMouseLeave={(ev) => {
                      (ev.currentTarget as HTMLElement).style.borderColor =
                        "rgba(110,231,216,0.10)";
                      (ev.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.035)";
                      (ev.currentTarget as HTMLElement).style.transform =
                        "translateY(0)";
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: meta.bg,
                        border: `1px solid ${meta.color}33`,
                        color: meta.color,
                        boxShadow: `0 0 12px ${meta.color}10`,
                      }}
                      title={meta.label}
                    >
                      <span className="text-sm font-bold">{e.mood}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--ui-heading)" }}
                        >
                          {moodEmoji[e.mood] ?? "🙂"} {meta.label}
                        </p>
                        <span
                          className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(110,231,216,0.09)",
                            color: "#6EE7D8",
                            border: "1px solid rgba(110,231,216,0.18)",
                          }}
                        >
                          {formatWhen(e.occurred_at)}
                        </span>
                      </div>

                      <textarea
                        defaultValue={e.note ?? ""}
                        placeholder="Add a note…"
                        className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                        style={{
                          minHeight: "64px",
                          resize: "none",
                          background: "var(--ui-surface)",
                          border: "1px solid var(--ui-border)",
                          color: "var(--ui-heading)",
                          outline: "none",
                        }}
                        onBlur={(ev) =>
                          updateNote(e.id, ev.currentTarget.value)
                        }
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteEntry(e.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg mt-1"
                      title="Delete"
                      style={{
                        color: "var(--ui-muted)",
                        transition: uiTransition,
                      }}
                      onMouseEnter={(ev) => {
                        (ev.currentTarget as HTMLElement).style.color =
                          "#f87171";
                      }}
                      onMouseLeave={(ev) => {
                        (ev.currentTarget as HTMLElement).style.color =
                          "var(--ui-muted)";
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
