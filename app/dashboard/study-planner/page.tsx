"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { supabase } from "../../../lib/supabase";
import { captureEvent } from "../../../lib/posthog/helpers";
import { EVENTS } from "../../../lib/posthog/events";
import {
  formatLastActiveDate,
  getStreak,
  type Streak,
  updateStreakOnTaskComplete,
} from "../../../lib/streaks";

type Priority = "high" | "medium" | "low";
type Task = {
  id: string;
  title: string;
  details: string | null;
  priority: Priority;
  status: "todo" | "in_progress" | "done";
  due: string | null;
  dueAt: string | null;
  created_at?: string;
};

type WeekDay = { day: string; date: number; tasks: number; active: boolean };
type Subject = { name: string; color: string; hours: number; pct: number };
type Deadline = {
  title: string;
  subject: string;
  due: string;
  urgent: boolean;
};

const initialTasks: Task[] = [];

const week: WeekDay[] = [
  { day: "Mon", date: 14, tasks: 4, active: false },
  { day: "Tue", date: 15, tasks: 6, active: false },
  { day: "Wed", date: 16, tasks: 5, active: true },
  { day: "Thu", date: 17, tasks: 3, active: false },
  { day: "Fri", date: 18, tasks: 7, active: false },
  { day: "Sat", date: 19, tasks: 2, active: false },
  { day: "Sun", date: 20, tasks: 1, active: false },
];

const subjects: Subject[] = [
  { name: "Mathematics", color: "#6EE7D8", hours: 8.5, pct: 85 },
  { name: "Physics", color: "#14B8A6", hours: 6.0, pct: 60 },
  { name: "Chemistry", color: "#5EEAD4", hours: 4.5, pct: 45 },
  { name: "English", color: "#8b5cf6", hours: 3.0, pct: 30 },
  { name: "History", color: "#f59e0b", hours: 2.0, pct: 20 },
];

const deadlines: Deadline[] = [
  {
    title: "Physics Assignment Final",
    subject: "Physics",
    due: "Apr 17",
    urgent: true,
  },
  {
    title: "Literature Essay",
    subject: "English",
    due: "Apr 19",
    urgent: false,
  },
  {
    title: "Chemistry Lab Report",
    subject: "Chemistry",
    due: "Apr 21",
    urgent: false,
  },
  {
    title: "Maths Unit Test",
    subject: "Mathematics",
    due: "Apr 24",
    urgent: false,
  },
];

const NOTIFICATIONS_KEY = "notificationsEnabled";
const REMINDERS_KEY = "remindersEnabled";
const SENT_REMINDERS_KEY = "eduflow_sent_reminders";

const pColor = (p: Priority) =>
  p === "high" ? "#f87171" : p === "medium" ? "#fbbf24" : "var(--ui-muted)";
const pBg = (p: Priority) =>
  p === "high"
    ? "rgba(239,68,68,0.10)"
    : p === "medium"
      ? "rgba(245,158,11,0.10)"
      : "rgba(255,255,255,0.05)";

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const extractDateKey = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
};

const formatReminderDate = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
};

const readSentReminderIds = () => {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = localStorage.getItem(SENT_REMINDERS_KEY);
    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch (error) {
    console.error("Error reading sent reminders:", error);
    return new Set<string>();
  }
};

const storeSentReminderIds = (ids: Set<string>) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error("Error saving sent reminders:", error);
  }
};

const shouldSendReminder = (
  dateKey: string | null,
  today: string,
  tomorrow: string,
) => {
  if (!dateKey) return null;
  if (dateKey === today) return "today" as const;
  if (dateKey === tomorrow) return "tomorrow" as const;
  return null;
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

export default function StudyPlannerPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planPrompt, setPlanPrompt] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planTyping, setPlanTyping] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);

  const [ageOrGrade, setAgeOrGrade] = useState("");
  const [intensity, setIntensity] = useState<"light" | "moderate" | "intensive">("moderate");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAge = localStorage.getItem("eduflow_planner_age_grade");
      if (savedAge) setAgeOrGrade(savedAge);
      const savedIntensity = localStorage.getItem("eduflow_planner_intensity");
      if (savedIntensity === "light" || savedIntensity === "moderate" || savedIntensity === "intensive") {
        setIntensity(savedIntensity);
      }
    }
  }, []);

  const savePreferences = (age: string, level: "light" | "moderate" | "intensive") => {
    if (typeof window !== "undefined") {
      localStorage.setItem("eduflow_planner_age_grade", age);
      localStorage.setItem("eduflow_planner_intensity", level);
    }
  };

  const [newLabel, setNewLabel] = useState("");
  const [newdetails, setNewdetails] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [focused, setFocused] = useState<string | null>(null);

  const done = tasks.filter((t) => t.status === "done").length;
  const pending = tasks.length - done;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const currentStreak = streak?.current_streak ?? 0;
  const longestStreak = streak?.longest_streak ?? 0;
  const lastActiveLabel = formatLastActiveDate(streak?.last_active_date ?? null);

  const priorityToDb = (p: Priority) =>
    p === "high" ? 3 : p === "medium" ? 2 : 1;
  const dbToPriority = (v: unknown): Priority => {
    if (v === "high" || v === "medium" || v === "low") return v;
    if (typeof v === "number")
      return v >= 3 ? "high" : v === 2 ? "medium" : "low";
    return "medium";
  };

  const formatDue = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const loadTasks = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("study_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (qErr) {
        setError(qErr.message);
        setTasks([]);
        return;
      }

      const mapped: Task[] = (data ?? []).map((row: any) => {
        const status: Task["status"] =
          row.status === "done" ||
          row.status === "in_progress" ||
          row.status === "todo"
            ? row.status
            : row.done
              ? "done"
              : "todo";
        const dueIso = (row.due_at ?? null) as string | null;
        return {
          id: String(row.id),
          title: (row.title ?? row.label ?? "") as string,
          details: (row.details ?? row.details ?? null) as
            | string
            | null,
          
          priority: dbToPriority(row.priority),
          status,
          due: formatDue(dueIso),
          dueAt: dueIso,
          created_at: row.created_at,
        };
      });

      setTasks(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks.");
      setTasks([]);
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
        await loadTasks();
        const streakData = await getStreak(supabase, data.user.id);
        if (alive) setStreak(streakData);
      } else {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const notificationsEnabled =
      localStorage.getItem(NOTIFICATIONS_KEY) === "true";
    const remindersEnabled = localStorage.getItem(REMINDERS_KEY) === "true";
    if (!notificationsEnabled || !remindersEnabled) return;

    const today = toDateKey(new Date());
    const tomorrow = toDateKey(addDays(new Date(), 1));
    const sentReminderIds = readSentReminderIds();
    let updated = false;

    tasks.forEach((task) => {
      if (task.status === "done") return;

      const dateKey = extractDateKey(task.dueAt);
      const reminderKind = shouldSendReminder(dateKey, today, tomorrow);
      if (!dateKey || !reminderKind) return;

      const reminderId = `${task.id}:${dateKey}:${reminderKind}`;
      if (sentReminderIds.has(reminderId)) return;

      sentReminderIds.add(reminderId);
      updated = true;

      const dueLabel =
        reminderKind === "today"
          ? "today"
          : `on ${formatReminderDate(dateKey)}`;
      try {
        new Notification("EduFlow AI Reminder", {
          body: `Your task '${task.title}' is due ${dueLabel}.`,
        });
      } catch (error) {
        console.error("Error showing reminder notification:", error);
      }
    });

    if (updated) {
      storeSentReminderIds(sentReminderIds);
    }
  }, [tasks]);

  const toggleStatus = async (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;

    const nextStatus: Task["status"] =
      current.status === "done" ? "todo" : "done";
    setTasks((ts) =>
      ts.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)),
    );

    try {
      const { error: upErr } = await supabase
        .from("study_tasks")
        .update({ status: nextStatus })
        .eq("id", id);
      if (upErr) {
        setTasks((ts) =>
          ts.map((t) => (t.id === id ? { ...t, status: current.status } : t)),
        );
        setError(upErr.message);
      } else if (nextStatus === "done") {
        captureEvent(EVENTS.TASK_COMPLETED, { priority: current.priority });
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.id) {
          const updatedStreak = await updateStreakOnTaskComplete(
            supabase,
            userData.user.id,
          );
          if (updatedStreak) setStreak(updatedStreak);
        }
      }
    } catch (e) {
      setTasks((ts) =>
        ts.map((t) => (t.id === id ? { ...t, status: current.status } : t)),
      );
      setError(e instanceof Error ? e.message : "Failed to update task.");
    }
  };

  const insertWithFallback = async (payload: Record<string, unknown>) => {
    const { data, error: firstErr } = await supabase
      .from("study_tasks")
      .insert(payload)
      .select("*")
      .single();

    if (!firstErr) return { data, error: null as any };

    const minimal: Record<string, unknown> = {
      title: payload.title,
      details: payload.details,
      due_at: payload.due_at,
      priority: payload.priority,
      status: payload.status,
      user_id: payload.user_id,
    };

    const { data: data2, error: secondErr } = await supabase
      .from("study_tasks")
      .insert(minimal)
      .select("*")
      .single();

    return { data: data2, error: secondErr ?? firstErr };
  };

  const addTask = async () => {
    if (!newLabel.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) {
        setError("You need to be logged in to add tasks.");
        return;
      }

      const dueIso = newDueDate
        ? new Date(`${newDueDate}T00:00:00.000Z`).toISOString()
        : null;

      const payload: Record<string, unknown> = {
        user_id: user.id,
        title: newLabel.trim(),
        details: newdetails.trim() || null,
        priority: priorityToDb(newPriority),
        status: "todo",
        due_at: dueIso,
      };

      const { data, error: insErr } = await insertWithFallback(payload);
      if (insErr) {
        setError(insErr.message ?? "Failed to create task.");
        return;
      }

      captureEvent(EVENTS.TASK_CREATED, { priority: newPriority, has_due_date: !!dueIso });
      await loadTasks();

      setNewLabel("");
      setNewdetails("");
      setNewDueDate("");
      setNewPriority("medium");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    setError(null);
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      const { error: delErr } = await supabase
        .from("study_tasks")
        .delete()
        .eq("id", id);
      if (delErr) {
        setTasks(prev);
        setError(delErr.message);
      } else {
        captureEvent(EVENTS.TASK_DELETED);
      }
    } catch (e) {
      setTasks(prev);
      setError(e instanceof Error ? e.message : "Failed to delete task.");
    }
  };

  const generateAiPlan = async () => {
    const prompt = planPrompt.trim();
    if (!prompt) return;

    setPlanLoading(true);
    setPlanTyping(false);
    setPlanError(null);
    setGeneratedPlan("Thinking...");

    try {
      const context = {
        source: "study-planner",
        totalTasks: tasks.length,
        ageOrGrade: ageOrGrade.trim(),
        intensity,
        pendingTasks: tasks
          .filter((task) => task.status !== "done")
          .map((task) => ({
            title: task.title,
            due: task.due,
            priority: task.priority,
            status: task.status,
          })),
      };

      const response = await fetch("/api/doubt-solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: "planner",
          userMessage: prompt,
          context,
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate study plan.");
      }

      if (!data.answer?.trim()) {
        throw new Error("AI returned an empty study plan.");
      }

      const plan = data.answer.trim();
      captureEvent(EVENTS.AI_STUDY_PLAN_GENERATED, { intensity, has_age_grade: !!ageOrGrade.trim(), task_count: tasks.length });
      setGeneratedPlan("");
      setPlanTyping(true);

      let index = 0;
      const chunkSize = 5;
      const timer = window.setInterval(() => {
        index += chunkSize;
        setGeneratedPlan(plan.slice(0, index));

        if (index >= plan.length) {
          window.clearInterval(timer);
          setPlanTyping(false);
        }
      }, 10);
    } catch (e) {
      setPlanError(
        e instanceof Error ? e.message : "Failed to generate study plan.",
      );
      setGeneratedPlan(null);
      setPlanTyping(false);
    } finally {
      setPlanLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    background: "var(--ui-surface)",
    border: `1px solid ${focused === field ? "rgba(110,231,216,0.45)" : "rgba(110,231,216,0.15)"}`,
    boxShadow: focused === field ? "0 0 0 3px rgba(110,231,216,0.07)" : "none",
    color: "var(--ui-heading)",
    outline: "none",
    borderRadius: "0.75rem",
    padding: "0.625rem 0.875rem",
    fontSize: "0.8125rem",
    width: "100%",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Study Planner
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--ui-heading)" }}
          >
            Plan smarter, study better.
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--ui-muted)" }}>
            Organise your tasks, track priority subjects, and never miss a
            deadline.
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--ui-heading)" }}
          >
            {pct}% done today
          </span>
        </div>
      </div>

      <Card>
        <SectionLabel>AI Study Plan Generator</SectionLabel>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: "var(--ui-muted)" }}
              >
                Age or Grade Level
              </label>
              <input
                type="text"
                value={ageOrGrade}
                onChange={(e) => {
                  setAgeOrGrade(e.target.value);
                  savePreferences(e.target.value, intensity);
                }}
                onFocus={() => setFocused("ageOrGrade")}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Class 10th, 15 years old"
                className="w-full"
                style={inputStyle("ageOrGrade")}
                disabled={planLoading || planTyping}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: "var(--ui-muted)" }}
              >
                Study Intensity
              </label>
              <div
                className="flex items-center gap-1.5 p-1 rounded-xl w-full"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid rgba(110,231,216,0.15)",
                  height: "38px",
                }}
              >
                {(["light", "moderate", "intensive"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setIntensity(level);
                      savePreferences(ageOrGrade, level);
                    }}
                    className="flex-1 h-full rounded-lg text-xs font-semibold capitalize transition-all duration-150"
                    style={{
                      background:
                        intensity === level
                          ? "linear-gradient(135deg,#6EE7D8,#14B8A6)"
                          : "transparent",
                      color: intensity === level ? "#111827" : "var(--ui-muted)",
                    }}
                    disabled={planLoading || planTyping}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "var(--ui-muted)" }}
            >
              Study Plan Prompt
            </label>
            <input
              type="text"
              value={planPrompt}
              onChange={(e) => {
                setPlanPrompt(e.target.value);
                if (planError) setPlanError(null);
              }}
              placeholder="Ask AI to generate your study plan..."
              className="w-full"
              style={{
                background: "var(--ui-surface)",
                border: "1px solid rgba(110,231,216,0.15)",
                color: "var(--ui-heading)",
                outline: "none",
                borderRadius: "0.75rem",
                padding: "0.625rem 0.875rem",
                fontSize: "0.875rem",
              }}
              disabled={planLoading || planTyping}
            />
          </div>

          <button
            type="button"
            onClick={generateAiPlan}
            disabled={planLoading || planTyping || !planPrompt.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background:
                !planLoading && !planTyping && planPrompt.trim()
                  ? "linear-gradient(135deg,#6EE7D8,#14B8A6)"
                  : "rgba(255,255,255,0.06)",
              color:
                !planLoading && !planTyping && planPrompt.trim()
                  ? "#111827"
                  : "var(--ui-subtle)",
              boxShadow:
                !planLoading && !planTyping && planPrompt.trim()
                  ? "0 4px 16px rgba(110,231,216,0.28)"
                  : "none",
              cursor:
                !planLoading && !planTyping && planPrompt.trim()
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {planLoading
              ? "Thinking..."
              : planTyping
                ? "Typing plan..."
                : "Generate Plan"}
          </button>

          {planLoading && (
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
              {["100%", "90%", "74%", "56%"].map((width) => (
                <div
                  key={width}
                  className="h-2.5 rounded-lg animate-pulse"
                  style={{ width, background: "rgba(110,231,216,0.18)" }}
                />
              ))}
            </div>
          )}

          {planError && (
            <div
              className="rounded-xl p-3 text-sm"
              role="alert"
              style={{
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.22)",
                color: "#b91c1c",
              }}
            >
              {planError}
            </div>
          )}

          {generatedPlan && (
            <div
              className="rounded-xl p-6"
              style={{
                background: "rgba(110,231,216,0.04)",
                border: "1px solid rgba(110,231,216,0.20)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-4"
                style={{ color: "#0f766e" }}
              >
                Generated Plan
              </p>
              <div
                className="text-sm leading-relaxed space-y-3 text-[var(--ui-text)]
                  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:text-[var(--ui-heading)]
                  [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2.5 [&_h2]:text-[var(--ui-heading)]
                  [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-3.5 [&_h3]:mb-2 [&_h3]:text-[var(--ui-heading)]
                  [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-[var(--ui-text)]
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1.5 [&_ul]:text-[var(--ui-text)]
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1.5 [&_ol]:text-[var(--ui-text)]
                  [&_li]:mb-1 [&_li]:text-sm
                  [&_strong]:font-semibold [&_strong]:text-[var(--ui-heading)]"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(generatedPlan + (planTyping ? " █" : "")) as string
                }}
              />
            </div>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="flex flex-col gap-5">
          <SectionLabel>Progress Summary</SectionLabel>

          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="rgba(110,231,216,0.10)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="url(#tealGrad)"
                  strokeWidth="3"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient
                    id="tealGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#6EE7D8" />
                    <stop offset="100%" stopColor="#14B8A6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-sm font-bold"
                  style={{ color: "#6EE7D8" }}
                >
                  {pct}%
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: "Completed", value: done, color: "#6EE7D8" },
                { label: "Pending", value: pending, color: "#fbbf24" },
                {
                  label: "Total",
                  value: tasks.length,
                  color: "var(--ui-muted)",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span style={{ color: "var(--ui-muted)" }}>{s.label}</span>
                  <span className="font-semibold" style={{ color: s.color }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: "rgba(110,231,216,0.05)",
              border: "1px solid var(--ui-border)",
            }}
          >
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg,#6EE7D8,#14B8A6)",
                color: "#0d2420",
              }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                  d="M12 3c1.4 2.7.9 4.8-.6 6.3-1.1 1.1-1.7 2.3-1.7 3.8a3.3 3.3 0 106.6 0c0-2.1-1.1-3.9-3.3-5.4m-1-4.7C7.6 5.8 5 9.5 5 13.4a7 7 0 0014 0c0-3.5-1.8-6.6-5.3-9.4"
                />
              </svg>
            </span>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--ui-heading)" }}
              >
                {loading
                  ? "Loading streak"
                  : currentStreak
                    ? `${currentStreak}-day streak`
                    : "Start your streak"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--ui-muted)" }}>
                {currentStreak
                  ? `Best ${longestStreak} days. Last active: ${lastActiveLabel}.`
                  : "Mark one study task done to count today."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionLabel>Weekly Study Plan</SectionLabel>
          <div className="grid grid-cols-7 gap-2">
            {week.map((d) => (
              <div
                key={d.day}
                className="flex flex-col items-center gap-2 py-3 rounded-xl cursor-pointer transition-all duration-150"
                style={{
                  background: d.active
                    ? "rgba(110,231,216,0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: d.active
                    ? "1px solid rgba(110,231,216,0.35)"
                    : "1px solid rgba(110,231,216,0.08)",
                  boxShadow: d.active
                    ? "0 0 12px rgba(110,231,216,0.10)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!d.active) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(110,231,216,0.25)";
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(110,231,216,0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!d.active) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(110,231,216,0.08)";
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.03)";
                  }
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: d.active ? "#0d9488" : "var(--ui-subtle)" }}
                >
                  {d.day}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: d.active ? "#6EE7D8" : "var(--ui-heading)" }}
                >
                  {d.date}
                </span>
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    background: d.active
                      ? "rgba(110,231,216,0.20)"
                      : "rgba(255,255,255,0.06)",
                    color: d.active ? "#0d9488" : "var(--ui-subtle)",
                  }}
                >
                  {d.tasks}t
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p
              className="text-[10px] mb-2"
              style={{ color: "var(--ui-muted)" }}
            >
              Weekly task load
            </p>
            <div className="flex items-end gap-1 h-8">
              {week.map((d) => (
                <div
                  key={d.day}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(d.tasks / 7) * 100}%`,
                    background: d.active
                      ? "linear-gradient(180deg,#6EE7D8,#14B8A6)"
                      : "rgba(110,231,216,0.18)",
                    minHeight: "4px",
                  }}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <SectionLabel>Today&apos;s Study Tasks</SectionLabel>
              <p
                className="text-sm font-semibold -mt-2"
                style={{ color: "var(--ui-heading)" }}
              >
                {done} of {tasks.length} completed
              </p>
            </div>
            <div className="w-24">
              <div
                className="w-full h-1.5 rounded-full"
                style={{ background: "var(--ui-surface-2)" }}
              >
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg,#6EE7D8,#14B8A6)",
                    boxShadow: "0 0 6px rgba(110,231,216,0.4)",
                  }}
                />
              </div>
              <p
                className="text-[10px] text-right mt-1"
                style={{ color: "var(--ui-muted)" }}
              >
                {pct}%
              </p>
            </div>
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
                  Loading your tasks…
                </p>
              </div>
            )}

            {!loading && error && (
              <div
                className="rounded-xl p-4"
                role="alert"
                style={{
                  background: "rgba(248,113,113,0.10)",
                  border: "1px solid rgba(248,113,113,0.22)",
                }}
              >
                <p className="text-sm" style={{ color: "#b91c1c" }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={loadTasks}
                  className="mt-3 text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{
                    background: "rgba(248,113,113,0.12)",
                    border: "1px solid rgba(248,113,113,0.25)",
                    color: "#b91c1c",
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && tasks.length === 0 && (
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
                  No tasks yet.
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "var(--ui-muted)" }}
                >
                  Add your first task on the right — keep it small and specific.
                </p>
              </div>
            )}

            {!loading &&
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-150 group"
                  style={{
                    background:
                      task.status === "done"
                        ? "rgba(110,231,216,0.04)"
                        : "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(110,231,216,0.08)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(110,231,216,0.22)";
                    (e.currentTarget as HTMLElement).style.background =
                      task.status === "done"
                        ? "rgba(110,231,216,0.07)"
                        : "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(110,231,216,0.08)";
                    (e.currentTarget as HTMLElement).style.background =
                      task.status === "done"
                        ? "rgba(110,231,216,0.04)"
                        : "rgba(255,255,255,0.03)";
                  }}
                >
                  <button
                    onClick={() => toggleStatus(task.id)}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150"
                    style={{
                      borderColor:
                        task.status === "done"
                          ? "#6EE7D8"
                          : "rgba(110,231,216,0.30)",
                      background:
                        task.status === "done" ? "#6EE7D8" : "transparent",
                    }}
                  >
                    {task.status === "done" && (
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="#111"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${task.status === "done" ? "line-through" : ""}`}
                      style={{
                        color:
                          task.status === "done"
                            ? "var(--ui-subtle)"
                            : "var(--ui-heading)",
                      }}
                    >
                      {task.title}
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--ui-muted)" }}
                    >
                      {[
                      task.due ? `Due ${task.due}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>

                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: pBg(task.priority),
                      color: pColor(task.priority),
                    }}
                  >
                    {task.priority}
                  </span>

                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded-lg"
                    title="Delete"
                    style={{ color: "var(--ui-muted)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#f87171";
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
              ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionLabel>Quick Add Task</SectionLabel>

          <div className="flex flex-col gap-3">
            {!loading && error && (
              <div
                className="rounded-xl px-3 py-2 text-sm"
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
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Task name
              </label>
              <input
                type="text"
                placeholder="e.g. Read Chapter 6"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onFocus={() => setFocused("label")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                style={inputStyle("label")}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                details
              </label>
              <textarea
                placeholder="Optional details (chapters, problems, goals)…"
                value={newdetails}
                onChange={(e) => setNewdetails(e.target.value)}
                onFocus={() => setFocused("details")}
                onBlur={() => setFocused(null)}
                style={{
                  ...inputStyle("details"),
                  minHeight: "84px",
                  resize: "none",
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Due date
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                onFocus={() => setFocused("due")}
                onBlur={() => setFocused(null)}
                style={inputStyle("due")}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--ui-heading)" }}
              >
                Priority
              </label>
              <div className="flex gap-2">
                {(["high", "medium", "low"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewPriority(p)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150"
                    style={{
                      background:
                        newPriority === p ? pBg(p) : "rgba(255,255,255,0.04)",
                      border: `1px solid ${newPriority === p ? pColor(p) + "55" : "rgba(255,255,255,0.08)"}`,
                      color: newPriority === p ? pColor(p) : "var(--ui-muted)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={addTask}
              disabled={!newLabel.trim() || saving}
              className="mt-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background:
                  newLabel.trim() && !saving
                    ? "linear-gradient(135deg,#6EE7D8,#14B8A6)"
                    : "rgba(255,255,255,0.06)",
                color:
                  newLabel.trim() && !saving ? "#111827" : "var(--ui-subtle)",
                boxShadow:
                  newLabel.trim() && !saving
                    ? "0 4px 16px rgba(110,231,216,0.28)"
                    : "none",
                cursor: newLabel.trim() && !saving ? "pointer" : "not-allowed",
                opacity: saving ? 0.8 : 1,
              }}
              onMouseEnter={(e) => {
                if (newLabel.trim() && !saving)
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 6px 24px rgba(110,231,216,0.45)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  newLabel.trim() && !saving
                    ? "0 4px 16px rgba(110,231,216,0.28)"
                    : "none";
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
                  Adding…
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
                  Add Task
                </>
              )}
            </button>
          </div>

          <div
            className="flex items-start gap-2.5 rounded-xl p-3 mt-auto"
            style={{
              background: "rgba(110,231,216,0.05)",
              border: "1px solid var(--ui-border)",
            }}
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
              style={{ color: "#6EE7D8" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: "var(--ui-muted)" }}
            >
              Press{" "}
              <kbd
                className="px-1 py-0.5 rounded text-[10px]"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--ui-heading)",
                }}
              >
                Enter
              </kbd>{" "}
              to quickly add.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <SectionLabel>Priority Subjects</SectionLabel>
          <div className="space-y-4">
            {subjects.map((s) => (
              <div key={s.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: s.color,
                        boxShadow: `0 0 6px ${s.color}70`,
                      }}
                    />
                    <span style={{ color: "var(--ui-heading)" }}>{s.name}</span>
                  </div>
                  <span style={{ color: "var(--ui-muted)" }}>
                    {s.hours}h this week
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full"
                  style={{ background: "var(--ui-surface-2)" }}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${s.pct}%`,
                      background: s.color,
                      boxShadow: `0 0 6px ${s.color}55`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel>Upcoming Deadlines</SectionLabel>
          <div className="space-y-3">
            {deadlines.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3.5 rounded-xl transition-all duration-150"
                style={{
                  background: d.urgent
                    ? "rgba(239,68,68,0.05)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${d.urgent ? "rgba(239,68,68,0.18)" : "rgba(110,231,216,0.08)"}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = d.urgent
                    ? "rgba(239,68,68,0.35)"
                    : "rgba(110,231,216,0.22)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = d.urgent
                    ? "rgba(239,68,68,0.18)"
                    : "rgba(110,231,216,0.08)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: d.urgent
                      ? "rgba(239,68,68,0.12)"
                      : "rgba(110,231,216,0.08)",
                    color: d.urgent ? "#f87171" : "#6EE7D8",
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--ui-heading)" }}
                  >
                    {d.title}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    {d.subject}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: d.urgent ? "#f87171" : "#6EE7D8" }}
                  >
                    {d.due}
                  </span>
                  {d.urgent && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        color: "#f87171",
                      }}
                    >
                      URGENT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
