"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useFeatureStatus } from "@/hooks/useFeatureStatus";
import { captureEvent } from "@/lib/posthog/helpers";
import { EVENTS } from "@/lib/posthog/events";

type SessionRow = {
  id: string;
  subject: string;
  duration_minutes: number;
  session_date: string;
  notes: string | null;
  created_at: string;
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 transition-all duration-200 ${className}`}
      style={{
        background: "var(--ui-surface)",
        border: "1px solid var(--ui-border)",
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

const formatDate = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getLocalIsoDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

type TaskStats = {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  upcomingDeadlines: Array<{ title: string; due: string; priority: string }>;
};

export default function ProductivityPage() {
  const { status: featureStatus, loading: featureLoading } = useFeatureStatus();
  const isAiActive = featureStatus ? featureStatus.ai.active : true;

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    upcomingDeadlines: [],
  });
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsTyping, setAiInsightsTyping] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState<string | null>(null);
  const [generatedInsights, setGeneratedInsights] = useState<string | null>(
    null,
  );

  const [subject, setSubject] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [sessionDate, setSessionDate] = useState(getLocalIsoDate());
  const [notes, setNotes] = useState("");

  const loadTasks = async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("study_tasks")
        .select("id,status,title,due_at,priority")
        .order("created_at", { ascending: false });

      if (qErr) {
        console.warn(
          "Could not load study tasks for productivity insights:",
          qErr?.message || qErr,
        );
        setTaskStats({
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          upcomingDeadlines: [],
        });
        return;
      }

      const tasks = data ?? [];
      const completed = tasks.filter((t: any) => t.status === "done").length;
      const pending = tasks.filter((t: any) => t.status !== "done").length;
      const today = new Date();
      const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

      const upcomingDeadlines = tasks
        .filter((t: any) => {
          if (!t.due_at) return false;
          const dueDate = new Date(t.due_at);
          return (
            dueDate >= today && dueDate <= twoWeeksOut && t.status !== "done"
          );
        })
        .slice(0, 5)
        .map((t: any) => ({
          title: t.title,
          due: new Date(t.due_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          priority:
            t.priority === 3 ? "high" : t.priority === 2 ? "medium" : "low",
        }));

      setTaskStats({
        totalTasks: tasks.length,
        completedTasks: completed,
        pendingTasks: pending,
        upcomingDeadlines,
      });
    } catch (e) {
      console.warn(
        "Could not load study tasks for productivity insights:",
        e instanceof Error ? e.message : e,
      );
      setTaskStats({
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        upcomingDeadlines: [],
      });
    }
  };

  const loadSessions = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("productivity_sessions")
        .select("id,subject,duration_minutes,session_date,notes,created_at")
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (qErr) {
        setError(qErr.message);
        setSessions([]);
        return;
      }

      const mapped: SessionRow[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        subject: String(row.subject ?? ""),
        duration_minutes: Number(row.duration_minutes ?? 0),
        session_date: String(row.session_date),
        notes: (row.notes ?? null) as string | null,
        created_at: String(row.created_at),
      }));
      setSessions(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions.");
      setSessions([]);
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
      if (data.user) {
        await loadSessions();
        await loadTasks();
      } else setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalMinutes = sessions.reduce(
      (sum, s) => sum + s.duration_minutes,
      0,
    );
    const totalHours = totalMinutes / 60;
    const totalSessions = sessions.length;
    const avgDuration = totalSessions
      ? Math.round(totalMinutes / totalSessions)
      : 0;
    const todayIso = getLocalIsoDate();
    const todayMinutes = sessions
      .filter((s) => s.session_date === todayIso)
      .reduce((sum, s) => sum + s.duration_minutes, 0);
    return {
      totalMinutes,
      totalHours,
      totalSessions,
      avgDuration,
      todayMinutes,
    };
  }, [sessions]);

  const addSession = async () => {
    const cleanSubject = subject.trim();
    const cleanDuration = Number(durationMinutes);
    if (
      !cleanSubject ||
      !Number.isFinite(cleanDuration) ||
      cleanDuration <= 0 ||
      !sessionDate
    )
      return;

    setError(null);
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) {
        setError("You need to be logged in to add sessions.");
        return;
      }

      const payload = {
        user_id: user.id,
        subject: cleanSubject,
        duration_minutes: Math.round(cleanDuration),
        session_date: sessionDate,
        notes: notes.trim() || null,
      };

      const { error: insErr } = await supabase
        .from("productivity_sessions")
        .insert(payload);
      if (insErr) {
        setError(insErr.message ?? "Failed to create session.");
        return;
      }

      captureEvent(EVENTS.STUDY_SESSION_LOGGED, { subject: cleanSubject, duration_minutes: Math.round(cleanDuration) });
      setSubject("");
      setDurationMinutes("");
      setSessionDate(getLocalIsoDate());
      setNotes("");
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (id: string) => {
    setError(null);
    const prev = sessions;
    setSessions((rows) => rows.filter((row) => row.id !== id));
    try {
      const { error: delErr } = await supabase
        .from("productivity_sessions")
        .delete()
        .eq("id", id);
      if (delErr) {
        setSessions(prev);
        setError(delErr.message);
      } else {
        captureEvent(EVENTS.STUDY_SESSION_DELETED);
      }
    } catch (e) {
      setSessions(prev);
      setError(e instanceof Error ? e.message : "Failed to delete session.");
    }
  };

  const generateAiInsights = async (force = false) => {
    if (!isAiActive) {
      setGeneratedInsights("Productivity Insights are currently disabled because the Gemini API key is missing. Set GEMINI_API_KEY in env.local to enable them.");
      setAiInsightsLoading(false);
      setAiInsightsTyping(false);
      return;
    }

    const dataStateKey = `${stats.totalSessions}-${stats.totalMinutes}-${taskStats.totalTasks}-${taskStats.completedTasks}`;

    if (!force) {
      const cached = localStorage.getItem("productivity_insights_cache");
      const cachedKey = localStorage.getItem("productivity_insights_state_key");
      if (cached && cachedKey === dataStateKey) {
        setGeneratedInsights(cached);
        setAiInsightsLoading(false);
        setAiInsightsTyping(false);
        return;
      }
    }

    setAiInsightsLoading(true);
    setAiInsightsTyping(false);
    setAiInsightsError(null);
    setGeneratedInsights("Thinking...");

    try {
      const context = {
        source: "productivity-tracker",
        totalStudyHours: stats.totalHours,
        totalSessions: stats.totalSessions,
        avgSessionDuration: stats.avgDuration,
        todayStudyTime: stats.todayMinutes,
        ...taskStats,
      };

      const response = await fetch("/api/doubt-solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: "productivity",
          userMessage:
            "Analyze my study productivity and give me actionable suggestions to improve.",
          context,
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to generate productivity insights.",
        );
      }

      if (!data.answer?.trim()) {
        throw new Error("AI returned empty insights.");
      }

      const insights = data.answer.trim();
      captureEvent(EVENTS.AI_PRODUCTIVITY_INSIGHTS_REFRESHED);
      localStorage.setItem("productivity_insights_cache", insights);
      localStorage.setItem("productivity_insights_state_key", dataStateKey);

      setGeneratedInsights("");
      setAiInsightsTyping(true);

      let index = 0;
      const chunkSize = 5;
      const timer = window.setInterval(() => {
        index += chunkSize;
        setGeneratedInsights(insights.slice(0, index));

        if (index >= insights.length) {
          window.clearInterval(timer);
          setAiInsightsTyping(false);
        }
      }, 10);
    } catch (e) {
      setAiInsightsError(
        e instanceof Error ? e.message : "Failed to generate insights.",
      );
      setGeneratedInsights(null);
      setAiInsightsTyping(false);
    } finally {
      setAiInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    generateAiInsights(false);
  }, [
    loading,
    stats.totalSessions,
    stats.totalMinutes,
    taskStats.totalTasks,
    taskStats.completedTasks,
  ]);

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
                d="M9 19V6m4 13V10m4 9V4"
              />
            </svg>
            Productivity Tracker
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--ui-heading)" }}
          >
            Track sessions. Improve consistency.
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--ui-muted)" }}>
            Log focused study sessions and monitor your progress every day.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Study Hours",
            value: `${stats.totalHours.toFixed(1)}h`,
          },
          { label: "Total Sessions", value: String(stats.totalSessions) },
          {
            label: "Average Session Duration",
            value: `${stats.avgDuration} min`,
          },
          { label: "Today's Study Time", value: `${stats.todayMinutes} min` },
        ].map((card) => (
          <Card key={card.label} className="p-5">
            <p className="text-xs" style={{ color: "var(--ui-muted)" }}>
              {card.label}
            </p>
            <p
              className="text-2xl font-bold mt-1"
              style={{ color: "var(--ui-heading)" }}
            >
              {card.value}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <SectionLabel>AI Productivity Insights</SectionLabel>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => generateAiInsights(true)}
            disabled={aiInsightsLoading || aiInsightsTyping || !isAiActive}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: isAiActive && !aiInsightsLoading && !aiInsightsTyping
                ? "linear-gradient(135deg,#6EE7D8,#14B8A6)"
                : "rgba(255,255,255,0.06)",
              color: isAiActive && !aiInsightsLoading && !aiInsightsTyping ? "#111827" : "var(--ui-subtle)",
              boxShadow: isAiActive && !aiInsightsLoading && !aiInsightsTyping
                ? "0 4px 16px rgba(110,231,216,0.28)"
                : "none",
              cursor: isAiActive && !aiInsightsLoading && !aiInsightsTyping ? "pointer" : "not-allowed",
              opacity: isAiActive ? 1 : 0.5,
            }}
          >
            {aiInsightsLoading
              ? "Thinking..."
              : aiInsightsTyping
                ? "Typing insights..."
                : "Refresh Insights"}
          </button>
          {aiInsightsLoading && (
            <div
              className="rounded-xl p-4 space-y-2"
              style={{
                background: "rgba(110,231,216,0.06)",
                border: "1px solid rgba(110,231,216,0.18)",
              }}
            >
              <p className="text-xs font-semibold" style={{ color: "#0f766e" }}>
                Thinking...
              </p>
              {["100%", "86%", "68%", "48%"].map((width) => (
                <div
                  key={width}
                  className="h-2.5 rounded-lg animate-pulse"
                  style={{ width, background: "rgba(110,231,216,0.18)" }}
                />
              ))}
            </div>
          )}
          {aiInsightsError && (
            <div
              className="rounded-xl p-3 text-sm"
              role="alert"
              style={{
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.22)",
                color: "#b91c1c",
              }}
            >
              {aiInsightsError}
            </div>
          )}
          {generatedInsights && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(110,231,216,0.06)",
                border: "1px solid rgba(110,231,216,0.22)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: "#0f766e" }}
              >
                Your Productivity Analysis
              </p>
              <p
                className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color: "var(--ui-heading)" }}
              >
                {generatedInsights}
                {aiInsightsTyping && <span className="animate-pulse">|</span>}
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <SectionLabel>Add Study Session</SectionLabel>
          {error && (
            <div
              className="rounded-xl px-3 py-2 text-sm mb-4"
              role="alert"
              style={{
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.22)",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="rounded-xl px-3 py-2.5 text-sm w-full"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid rgba(110,231,216,0.15)",
                  color: "var(--ui-heading)",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Duration (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 50"
                className="rounded-xl px-3 py-2.5 text-sm w-full"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid rgba(110,231,216,0.15)",
                  color: "var(--ui-heading)",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="rounded-xl px-3 py-2.5 text-sm w-full"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid rgba(110,231,216,0.15)",
                  color: "var(--ui-heading)",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you study in this session?"
                className="rounded-xl px-3 py-2.5 text-sm w-full"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid rgba(110,231,216,0.15)",
                  color: "var(--ui-heading)",
                  outline: "none",
                  minHeight: "88px",
                  resize: "none",
                }}
              />
            </div>

            <button
              type="button"
              onClick={addSession}
              disabled={
                saving ||
                !subject.trim() ||
                !sessionDate ||
                Number(durationMinutes) <= 0
              }
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background:
                  !saving &&
                  subject.trim() &&
                  sessionDate &&
                  Number(durationMinutes) > 0
                    ? "linear-gradient(135deg,#6EE7D8,#14B8A6)"
                    : "rgba(255,255,255,0.06)",
                color:
                  !saving &&
                  subject.trim() &&
                  sessionDate &&
                  Number(durationMinutes) > 0
                    ? "#111827"
                    : "var(--ui-subtle)",
                boxShadow:
                  !saving &&
                  subject.trim() &&
                  sessionDate &&
                  Number(durationMinutes) > 0
                    ? "0 4px 16px rgba(110,231,216,0.28)"
                    : "none",
                cursor:
                  !saving &&
                  subject.trim() &&
                  sessionDate &&
                  Number(durationMinutes) > 0
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              {saving ? "Adding…" : "Add Session"}
            </button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Session History</SectionLabel>
            <button
              type="button"
              onClick={loadSessions}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              style={{
                background: "var(--ui-surface-2)",
                border: "1px solid var(--ui-border)",
                color: "var(--ui-text)",
              }}
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2.5">
            {loading && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--ui-surface-2)",
                  border: "1px solid var(--ui-border)",
                }}
              >
                <p className="text-sm" style={{ color: "var(--ui-muted)" }}>
                  Loading your sessions…
                </p>
              </div>
            )}

            {!loading && sessions.length === 0 && !error && (
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(110,231,216,0.05)",
                  border: "1px dashed rgba(110,231,216,0.18)",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--ui-heading)" }}
                >
                  No sessions yet.
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "var(--ui-muted)" }}
                >
                  Add your first session to start tracking productivity.
                </p>
              </div>
            )}

            {!loading &&
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="group rounded-xl p-4 transition-all duration-150"
                  style={{
                    background: "var(--ui-surface-2)",
                    border: "1px solid var(--ui-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--ui-heading)" }}
                      >
                        {session.subject}
                      </p>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--ui-muted)" }}
                      >
                        {session.duration_minutes} min •{" "}
                        {formatDate(session.session_date)}
                      </p>
                      {session.notes ? (
                        <p
                          className="text-xs mt-2 whitespace-pre-wrap"
                          style={{ color: "var(--ui-text)" }}
                        >
                          {session.notes}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteSession(session.id)}
                      className="p-1.5 rounded-lg transition-colors duration-150"
                      style={{ color: "var(--ui-muted)" }}
                      title="Delete session"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color =
                          "#f87171";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color =
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
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
