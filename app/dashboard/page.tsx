"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatLastActiveDate, getStreak, type Streak } from "@/lib/streaks";
import { useRecommendations } from "@/hooks/useRecommendations";
import RecommendationCard from "@/components/RecommendationCard";
import { useFeatureStatus } from "@/hooks/useFeatureStatus";

type OverviewCard = {
  title: string;
  value: string;
  sub: string;
  delta: string;
  deltaPositive: boolean;
  href: string;
  accent: string;
  icon: React.ReactNode;
};

type QuickAction = {
  label: string;
  href: string;
  icon: React.ReactNode;
  details: string;
};

type DbTask = {
  id: string;
  title: string | null;
  details: string | null;
  status: "done" | "in_progress" | "todo" | string;
  created_at?: string | null;
};

const WeeklyProgressChart = memo(function WeeklyProgressChart({
  loading,
  weeklyProgress,
  weeklyProgressError,
  weeklyHasProgress,
  weeklyMax,
}: {
  loading: boolean;
  weeklyProgress: WeeklyProgressDay[];
  weeklyProgressError: string | null;
  weeklyHasProgress: boolean;
  weeklyMax: number;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-7 gap-2 sm:gap-3 h-44 items-end">
        {weeklyProgress.map((day) => (
          <div key={day.key} className="flex flex-col items-center gap-2">
            <div
              className="w-full max-w-12 rounded-t-xl animate-pulse"
              style={{
                height: "72px",
                background: "rgba(110,231,216,0.18)",
              }}
            />
            <div
              className="h-3 w-8 rounded animate-pulse"
              style={{ background: "rgba(110,231,216,0.16)" }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (weeklyProgressError) {
    return (
      <div
        className="rounded-xl p-4 text-sm"
        role="alert"
        style={{
          background: "rgba(248,113,113,0.10)",
          border: "1px solid rgba(248,113,113,0.18)",
          color: "var(--dash-danger)",
        }}
      >
        Weekly progress is unavailable.
      </div>
    );
  }

  if (!weeklyHasProgress) {
    return (
      <div
        className="flex min-h-44 items-center justify-center rounded-xl px-4 text-center"
        style={{
          background: "var(--dash-empty-bg)",
          border: "1px dashed var(--dash-empty-border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--ui-muted)" }}>
          No weekly progress yet. Complete a task to see your progress.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2 sm:gap-3 h-48 items-end">
      {weeklyProgress.map((day) => {
        const height = Math.max(
          10,
          Math.round((day.count / weeklyMax) * 100),
        );

        return (
          <div
            key={day.key}
            className="h-full flex flex-col items-center justify-end gap-2 min-w-0"
          >
            <span
              className="text-[10px] sm:text-xs font-bold"
              style={{
                color: day.count
                  ? "var(--dash-teal-strong)"
                  : "var(--ui-subtle)",
              }}
            >
              {day.count}
            </span>
            <div className="w-full flex items-end justify-center h-32 sm:h-36">
              <div
                className="w-full max-w-12 rounded-t-xl transition-all duration-300"
                style={{
                  height: `${height}%`,
                  minHeight: day.count ? "18px" : "10px",
                  background: day.count
                    ? "linear-gradient(180deg, #6EE7D8 0%, #14B8A6 100%)"
                    : "rgba(110,231,216,0.14)",
                  boxShadow: day.count
                    ? "0 10px 24px rgba(20,184,166,0.22)"
                    : "none",
                }}
                title={`${day.label}: ${day.count} completed ${
                  day.count === 1 ? "task" : "tasks"
                }`}
              />
            </div>
            <span
              className="text-[10px] sm:text-xs font-semibold truncate"
              style={{ color: "var(--ui-muted)" }}
            >
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
});
type DbWeeklyTask = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};
type DbNote = {
  id: string;
  title: string | null;
  updated_at: string | null;
  created_at?: string | null;
};
type DbMood = {
  id: string;
  mood: number;
  note: string | null;
  occurred_at: string;
};
type DbProductivity = { duration_minutes: number; session_date: string };

type FocusItem = {
  label: string;
  done: boolean;
  priority: "high" | "medium" | "low";
};
type ActivityItem = {
  text: string;
  time: string;
  tag: string;
  tagColor?: string;
};
type WeeklyProgressDay = {
  key: string;
  label: string;
  count: number;
};

const focusSkeletonRows = [0, 1, 2, 3];

const quickActions: QuickAction[] = [
  {
    label: "Ask AI",
    details: "Instant answers",
    href: "/dashboard/doubt-solver",
    icon: (
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
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    label: "New Note",
    details: "AI-generated",
    href: "/dashboard/notes",
    icon: (
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
          d="M12 4v16m8-8H4"
        />
      </svg>
    ),
  },
  {
    label: "Add Task",
    details: "Study planner",
    href: "/dashboard/study-planner",
    icon: (
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
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    label: "Log Mood",
    details: "How are you?",
    href: "/dashboard/mood",
    icon: (
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
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

const priorityStyle = (p: string) => ({
  background:
    p === "high"
      ? "rgba(239,68,68,0.10)"
      : p === "medium"
        ? "rgba(245,158,11,0.10)"
        : "rgba(255,255,255,0.05)",
  color:
    p === "high" ? "#f87171" : p === "medium" ? "#fbbf24" : "var(--ui-subtle)",
});

const fmtCompact = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);

const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
};

const moodLabel = (mood: number) => {
  if (mood >= 5) return "😁 Great";
  if (mood >= 4) return "😊 Good";
  if (mood >= 3) return "😐 Okay";
  if (mood >= 2) return "😕 Low";
  return "😞 Rough";
};

const formatHoursMinutes = (minutes: number) => {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${mins}m`;
};

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildWeeklyProgressDays = (): WeeklyProgressDay[] => {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      key: toLocalDateKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
    };
  });
};

const countWeeklyCompletedTasks = (
  tasks: DbWeeklyTask[],
): WeeklyProgressDay[] => {
  const days = buildWeeklyProgressDays();
  const dayCounts = new Map(days.map((day) => [day.key, 0]));

  tasks.forEach((task) => {
    const completedAt = task.updated_at ?? task.created_at;
    if (!completedAt) return;

    const completedDate = new Date(completedAt);
    if (Number.isNaN(completedDate.getTime())) return;

    const dateKey = toLocalDateKey(completedDate);
    if (!dayCounts.has(dateKey)) return;

    dayCounts.set(dateKey, (dayCounts.get(dateKey) ?? 0) + 1);
  });

  return days.map((day) => ({
    ...day,
    count: dayCounts.get(day.key) ?? 0,
  }));
};

const resolveDisplayName = (
  user: {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  } | null,
) => {
  const fullName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const name =
    typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";
  const emailPrefix = user?.email?.trim()?.split("@")[0]?.trim() ?? "";

  return fullName || name || emailPrefix || "Student";
};

const RecommendationsSection = memo(function RecommendationsSection() {
  const { recommendations, loading, error, generatedAt, rawInsight, refresh } =
    useRecommendations();

  return (
    <RecommendationCard
      recommendations={recommendations}
      loading={loading}
      error={error}
      generatedAt={generatedAt}
      rawInsight={rawInsight}
      onRefresh={refresh}
    />
  );
});

export default function DashboardPage() {
  const { status: featureStatus, loading: featureLoading } = useFeatureStatus();
  const isAiActive = featureStatus ? featureStatus.ai.active : true;

  const now = useMemo(() => new Date(), []);
  const greeting = "Welcome back";

  const [displayName, setDisplayName] = useState("Student");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskTotal, setTaskTotal] = useState<number>(0);
  const [taskDone, setTaskDone] = useState<number>(0);
  const [taskPending, setTaskPending] = useState<number>(0);
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);

  const [notesTotal, setNotesTotal] = useState<number>(0);
  const [latestNote, setLatestNote] = useState<DbNote | null>(null);

  const [latestMood, setLatestMood] = useState<DbMood | null>(null);
  const [productivitySessions, setProductivitySessions] = useState<number>(0);
  const [productivityTotalMinutes, setProductivityTotalMinutes] =
    useState<number>(0);
  const [productivityTodayMinutes, setProductivityTodayMinutes] =
    useState<number>(0);

  const [streak, setStreak] = useState<Streak | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgressDay[]>(
    () => buildWeeklyProgressDays(),
  );
  const [weeklyProgressError, setWeeklyProgressError] = useState<string | null>(
    null,
  );

  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsTyping, setAiInsightsTyping] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState<string | null>(null);
  const [generatedInsights, setGeneratedInsights] = useState<string | null>(
    null,
  );
  const [todaySlots, setTodaySlots] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const { account } = await import("../../lib/appwrite");
        const appwriteUser = await account.get();
        if (!alive) return;
        
        // Map Appwrite user to the User type expected
        const mappedUser = {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          user_metadata: {
            full_name: appwriteUser.name,
          }
        };

        setDisplayName(resolveDisplayName(mappedUser as any));
        setWeeklyProgress(buildWeeklyProgressDays());
        setWeeklyProgressError(null);

        const userId = appwriteUser.$id;

        const [
          allTasksRes,
          doneTasksRes,
          totalTasksCountRes,
          weeklyTasksRes,
          notesCountRes,
          latestNoteRes,
          latestMoodRes,
          productivityRes,
          streakData,
        ] = await Promise.all([
          supabase
            .from("study_tasks")
            .select("id,title,details,status,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(4),
          supabase
            .from("study_tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "done"),
          supabase
            .from("study_tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
          supabase
            .from("study_tasks")
            .select("id,created_at,updated_at")
            .eq("user_id", userId)
            .eq("status", "done")
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("notes")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
          supabase
            .from("notes")
            .select("id,title,updated_at,created_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("mood_entries")
            .select("id,mood,note,occurred_at")
            .eq("user_id", userId)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("productivity_sessions")
            .select("duration_minutes,session_date")
            .eq("user_id", userId),
          getStreak(supabase, userId),
        ]);

        if (!alive) return;
        setStreak(streakData);

        if (!alive) return;

        if (allTasksRes.error) {
          console.warn("[dashboard] Failed to load recent tasks:", allTasksRes.error.message);
        }
        if (doneTasksRes.error) {
          console.warn("[dashboard] Failed to load completed task count:", doneTasksRes.error.message);
        }
        if (totalTasksCountRes.error) {
          console.warn("[dashboard] Failed to load total task count:", totalTasksCountRes.error.message);
        }
        if (weeklyTasksRes.error) {
          const fallbackWeeklyTasksRes = await supabase
            .from("study_tasks")
            .select("id,created_at")
            .eq("user_id", userId)
            .eq("status", "done")
            .order("created_at", { ascending: false })
            .limit(500);

          if (fallbackWeeklyTasksRes.error) {
            setWeeklyProgressError(fallbackWeeklyTasksRes.error.message);
          } else {
            setWeeklyProgress(
              countWeeklyCompletedTasks(
                (fallbackWeeklyTasksRes.data ?? []) as DbWeeklyTask[],
              ),
            );
          }
        } else {
          setWeeklyProgress(
            countWeeklyCompletedTasks(
              (weeklyTasksRes.data ?? []) as DbWeeklyTask[],
            ),
          );
        }
        if (notesCountRes.error) {
          console.warn("[dashboard] Failed to load notes count:", notesCountRes.error.message);
        }
        if (latestNoteRes.error) {
          console.warn("[dashboard] Failed to load latest note:", latestNoteRes.error.message);
        }
        if (latestMoodRes.error) {
          console.warn("[dashboard] Failed to load latest mood:", latestMoodRes.error.message);
        }
        if (productivityRes.error) {
          console.warn("[dashboard] Failed to load productivity sessions:", productivityRes.error.message);
        }

        const tasks = (allTasksRes.data ?? []) as DbTask[];
        const totalFromList = tasks.length;

        const total = totalTasksCountRes.count ?? totalFromList ?? 0;
        const done = doneTasksRes.count ?? 0;
        const pending = Math.max(0, total - done);

        setTaskTotal(total);
        setTaskDone(done);
        setTaskPending(pending);

        const mappedFocus: FocusItem[] = tasks.map((t) => ({
          label: String(t.title ?? t.details ?? "Untitled task"),
          done: t.status === "done",
          priority: "medium",
        }));
        setFocusItems(mappedFocus);

        setNotesTotal(notesCountRes.count ?? 0);
        setLatestNote((latestNoteRes.data as DbNote | null) ?? null);
        setLatestMood((latestMoodRes.data as DbMood | null) ?? null);

        const localToday = new Date();
        const todayIso = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;
        const productivity = (productivityRes.data ?? []) as DbProductivity[];
        const totalMinutes = productivity.reduce(
          (sum, row) => sum + Number(row.duration_minutes ?? 0),
          0,
        );
        const todayMinutes = productivity
          .filter((row) => row.session_date === todayIso)
          .reduce((sum, row) => sum + Number(row.duration_minutes ?? 0), 0);

        setProductivitySessions(productivity.length);
        setProductivityTotalMinutes(totalMinutes);
        setProductivityTodayMinutes(todayMinutes);

        // Load today's schedule slots separately to handle fallback gracefully
        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayDayName = weekdays[new Date().getDay()];
        let todaySlotsData: any[] = [];
        try {
          const { data: slotsRes, error: slotsErr } = await supabase
            .from("timetable_slots")
            .select("*")
            .eq("day", todayDayName)
            .order("start_time", { ascending: true });

          if (slotsErr) {
            const isTableMissing =
              slotsErr.code === "42P01" ||
              slotsErr.code === "PGRST204" ||
              slotsErr.message?.toLowerCase().includes("schema cache") ||
              slotsErr.message?.toLowerCase().includes("does not exist");

            if (isTableMissing) {
              const localData = localStorage.getItem(`timetable_slots_${u.user.id}`);
              if (localData) {
                const parsed = JSON.parse(localData);
                todaySlotsData = parsed.filter((s: any) => s.day === todayDayName);
              }
            } else {
              console.error("Supabase timetable error:", slotsErr.message);
            }
          } else {
            todaySlotsData = slotsRes || [];
          }
        } catch (err) {
          console.error("Error loading timetable slots:", err);
          const localData = localStorage.getItem(`timetable_slots_${u.user.id}`);
          if (localData) {
            const parsed = JSON.parse(localData);
            todaySlotsData = parsed.filter((s: any) => s.day === todayDayName);
          }
        }
        todaySlotsData.sort((a, b) => {
          const [ah, am] = a.start_time.split(":").map(Number);
          const [bh, bm] = b.start_time.split(":").map(Number);
          return (ah * 60 + am) - (bh * 60 + bm);
        });
        if (alive) {
          setTodaySlots(todaySlotsData);
        }
      } catch (e) {
        if (!alive) return;
        setError(
          e instanceof Error ? e.message : "Failed to load dashboard overview.",
        );
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const generateAiInsights = async (force = false) => {
    if (!isAiActive) {
      setGeneratedInsights("Productivity Insights are currently disabled because the Gemini API key is missing. Set GEMINI_API_KEY in env.local to enable them.");
      setAiInsightsLoading(false);
      setAiInsightsTyping(false);
      return;
    }

    const dataStateKey = `${productivitySessions}-${productivityTotalMinutes}-${taskTotal}-${taskDone}`;

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
      const avgSessionDuration = productivitySessions
        ? Math.round(productivityTotalMinutes / productivitySessions)
        : 0;

      const context = {
        source: "productivity-tracker",
        totalStudyHours: productivityTotalMinutes / 60,
        totalSessions: productivitySessions,
        avgSessionDuration,
        todayStudyTime: productivityTodayMinutes,
        totalTasks: taskTotal,
        completedTasks: taskDone,
        pendingTasks: taskPending,
        upcomingDeadlines: [],
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
    productivitySessions,
    productivityTotalMinutes,
    taskTotal,
    taskDone,
  ]);

  const progressPct = useMemo(() => {
    if (!focusItems.length) return 0;
    const done = focusItems.filter((t) => t.done).length;
    return Math.round((done / focusItems.length) * 100);
  }, [focusItems]);
  const focusDoneCount = useMemo(
    () => focusItems.filter((task) => task.done).length,
    [focusItems],
  );
  const focusSummary = useMemo(
    () =>
      loading
        ? "Loading tasks..."
        : `${focusDoneCount} of ${focusItems.length} tasks completed`,
    [focusDoneCount, focusItems.length, loading],
  );

  const weeklyMax = useMemo(
    () => Math.max(1, ...weeklyProgress.map((day) => day.count)),
    [weeklyProgress],
  );
  const weeklyTotal = useMemo(
    () => weeklyProgress.reduce((sum, day) => sum + day.count, 0),
    [weeklyProgress],
  );
  const weeklyHasProgress = weeklyTotal > 0;
  const weeklySummary = useMemo(() => {
    if (loading) return "Loading weekly progress...";
    if (weeklyProgressError) return "Could not load weekly progress right now.";
    if (!weeklyHasProgress) {
      return "No weekly progress yet. Complete a task to see your progress.";
    }

    return `${weeklyTotal} completed ${
      weeklyTotal === 1 ? "task" : "tasks"
    } this week`;
  }, [loading, weeklyHasProgress, weeklyProgressError, weeklyTotal]);

  const overviewCards: OverviewCard[] = useMemo(() => {
    const tasksValue = loading ? "—" : `${taskDone} / ${taskTotal}`;
    const tasksDelta = error
      ? "Could not load"
      : taskPending
        ? `${taskPending} pending`
        : "All caught up ✓";

    const notesValue = loading ? "—" : fmtCompact(notesTotal);
    const notesDelta = error
      ? "Could not load"
      : latestNote?.title
        ? `Latest: ${latestNote.title}`
        : notesTotal
          ? "Recently updated"
          : "No notes yet";

    const moodValue = loading
      ? "—"
      : latestMood
        ? moodLabel(latestMood.mood)
        : "—";
    const moodDelta = error
      ? "Could not load"
      : latestMood
        ? timeAgo(latestMood.occurred_at)
        : "Log your first mood";

    const streakValue = loading ? "—" : `${streak?.current_streak ?? 0}`;
    const streakDelta = error
      ? "Could not load"
      : streak?.current_streak
        ? `Best: ${streak.longest_streak} days`
        : "Complete a task";

    return [
      {
        title: "Study Planner",
        value: tasksValue,
        sub: "tasks completed",
        delta: tasksDelta,
        deltaPositive: !error,
        href: "/dashboard/study-planner",
        accent: "#6EE7D8",
        icon: (
          <svg
            className="w-4.5 h-4.5 w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        ),
      },
      {
        title: "AI Doubt Solver",
        value: isAiActive ? "—" : "Disabled",
        sub: isAiActive ? "questions solved" : "Missing API Key",
        delta: isAiActive ? "Ask a question →" : "Inactive (Set GEMINI_API_KEY)",
        deltaPositive: isAiActive,
        href: "/dashboard/doubt-solver",
        accent: isAiActive ? "#14B8A6" : "#6b7280",
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        ),
      },
      {
        title: "Notes",
        value: notesValue,
        sub: notesTotal === 1 ? "note saved" : "notes saved",
        delta: notesDelta,
        deltaPositive: !error,
        href: "/dashboard/notes",
        accent: "#5EEAD4",
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        ),
      },
      {
        title: "Productivity",
        value: loading ? "—" : formatHoursMinutes(productivityTotalMinutes),
        sub: loading
          ? "sessions"
          : `${productivitySessions} ${productivitySessions === 1 ? "session" : "sessions"}`,
        delta: error
          ? "Could not load"
          : productivitySessions
            ? `${formatHoursMinutes(productivityTodayMinutes)} today`
            : "0h 0m today",
        deltaPositive: !error,
        href: "/dashboard/productivity",
        accent: "#6EE7D8",
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        ),
      },
      {
        title: "Mood",
        value: moodValue,
        sub: latestMood ? "latest check-in" : "no check-ins yet",
        delta: moodDelta,
        deltaPositive: !error,
        href: "/dashboard/mood",
        accent: "#14B8A6",
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      },
      {
        title: "Streak",
        value: streakValue,
        sub: streak?.current_streak ? "days in a row" : "consistency tracker",
        delta: streakDelta,
        deltaPositive: !error,
        href: "/dashboard/study-planner",
        accent: "#14B8A6",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 3c1.4 2.7.9 4.8-.6 6.3-1.1 1.1-1.7 2.3-1.7 3.8a3.3 3.3 0 106.6 0c0-2.1-1.1-3.9-3.3-5.4m-1-4.7C7.6 5.8 5 9.5 5 13.4a7 7 0 0014 0c0-3.5-1.8-6.6-5.3-9.4"
            />
          </svg>
        ),
      },
    ];
  }, [
    error,
    latestMood,
    latestNote,
    loading,
    notesTotal,
    productivitySessions,
    productivityTodayMinutes,
    productivityTotalMinutes,
    taskDone,
    taskPending,
    taskTotal,
    streak,
  ]);

  const recentActivity: ActivityItem[] = useMemo(() => {
    if (loading)
      return [{ text: "Loading your activity…", time: "", tag: "Overview" }];
    if (error)
      return [
        { text: "Could not load recent activity.", time: "", tag: "Overview" },
      ];
    const items: ActivityItem[] = [];
    if (latestNote?.title) {
      items.push({
        text: `Updated note: ${latestNote.title}`,
        time: timeAgo(latestNote.updated_at ?? latestNote.created_at),
        tag: "Notes",
        tagColor: "#5EEAD4",
      });
    }
    if (latestMood) {
      items.push({
        text: `Mood check-in: ${moodLabel(latestMood.mood)}`,
        time: timeAgo(latestMood.occurred_at),
        tag: "Mood",
        tagColor: "#14B8A6",
      });
    }
    if (taskDone > 0) {
      items.push({
        text: `${taskDone} tasks completed`,
        time: "Total",
        tag: "Planner",
        tagColor: "#6EE7D8",
      });
    } else if (taskTotal > 0) {
      items.push({
        text: `${taskPending} tasks pending`,
        time: "Total",
        tag: "Planner",
        tagColor: "#6EE7D8",
      });
    }
    if (!items.length) {
      return [
        {
          text: "No activity yet — start by adding a task, note, or mood check-in.",
          time: "",
          tag: "Overview",
        },
      ];
    }
    return items.slice(0, 4);
  }, [
    error,
    latestMood,
    latestNote,
    loading,
    taskDone,
    taskPending,
    taskTotal,
  ]);

  const streakCurrent = loading ? "—" : String(streak?.current_streak ?? 0);
  const streakLongest = loading ? "—" : String(streak?.longest_streak ?? 0);
  const streakLastActive = loading
    ? "Loading..."
    : formatLastActiveDate(streak?.last_active_date ?? null);
  const streakCount = streak?.current_streak ?? 0;
  const streakBadge =
    streakCount >= 30
      ? {
          label: "Legend",
          tone: "#f59e0b",
          glow: "rgba(245,158,11,0.26)",
          background:
            "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(255,255,255,0.72))",
        }
      : streakCount >= 14
        ? {
            label: "Focused",
            tone: "#14B8A6",
            glow: "rgba(20,184,166,0.24)",
            background:
              "linear-gradient(135deg, rgba(20,184,166,0.18), rgba(255,255,255,0.72))",
          }
        : streakCount >= 7
          ? {
              label: "Consistent",
              tone: "#0d9488",
              glow: "rgba(13,148,136,0.24)",
              background:
                "linear-gradient(135deg, rgba(45,212,191,0.22), rgba(255,255,255,0.74))",
            }
          : streakCount >= 3
            ? {
                label: "Starter",
                tone: "#0f766e",
                glow: "rgba(15,118,110,0.18)",
                background:
                  "linear-gradient(135deg, rgba(110,231,216,0.20), rgba(255,255,255,0.72))",
              }
            : null;
  const streakMotivation = error
    ? "Streak details will return once your data loads."
    : streakCount >= 30
      ? "Legend status. Keep going 🔥"
      : streakCount >= 14
        ? "Deep focus is becoming a habit."
        : streakCount >= 7
          ? "You're on a roll!"
          : streakCount > 0
            ? "Keep going 🔥"
            : "Complete a task to light the streak.";
  const flameGlow =
    streakCount >= 7
      ? "0 0 22px rgba(245,158,11,0.48), 0 0 44px rgba(20,184,166,0.24)"
      : streakCount > 0
        ? "0 0 16px rgba(245,158,11,0.32), 0 0 28px rgba(20,184,166,0.16)"
        : "none";
  const streakMetricItems = useMemo(
    () => [
      ["Current", streakCurrent],
      ["Longest", streakLongest],
      ["Last active", streakLastActive],
    ],
    [streakCurrent, streakLastActive, streakLongest],
  );
  const handlePrimaryCtaEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.boxShadow =
        "0 6px 22px rgba(110,231,216,0.44)";
      e.currentTarget.style.transform = "translateY(-2px)";
    },
    [],
  );
  const handlePrimaryCtaLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.boxShadow =
        "0 3px 14px rgba(110,231,216,0.28)";
      e.currentTarget.style.transform = "translateY(0)";
    },
    [],
  );
  const handleTextLinkEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.color = "var(--dash-link-hover)";
    },
    [],
  );
  const handleTextLinkLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.color = "var(--dash-link)";
    },
    [],
  );
  const handleQuickActionEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.style.borderColor = "rgba(110,231,216,0.28)";
      el.style.background = "rgba(110,231,216,0.08)";
      el.style.color = "var(--ui-heading)";
      el.style.transform = "translateY(-1px)";
    },
    [],
  );
  const handleQuickActionLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.style.borderColor = "rgba(110,231,216,0.09)";
      el.style.background = "rgba(110,231,216,0.04)";
      el.style.color = "var(--ui-text)";
      el.style.transform = "translateY(0)";
    },
    [],
  );

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1280px] mx-auto space-y-8 [--dash-danger:#b91c1c] [--dash-empty-bg:rgba(110,231,216,0.07)] [--dash-empty-border:rgba(20,184,166,0.22)] [--dash-link:#0d9488] [--dash-link-hover:#115e59] [--dash-panel-shadow:0_12px_32px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] [--dash-streak-metric-bg:rgba(255,255,255,0.68)] [--dash-streak-metric-border:rgba(20,184,166,0.15)] [--dash-streak-metric-shadow:0_8px_20px_rgba(15,118,110,0.08)] [--dash-teal-strong:#0f766e] dark:[--dash-danger:#fca5a5] dark:[--dash-empty-bg:rgba(15,23,42,0.62)] dark:[--dash-empty-border:rgba(94,234,212,0.24)] dark:[--dash-link:#5eead4] dark:[--dash-link-hover:#99f6e4] dark:[--dash-panel-shadow:0_14px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(94,234,212,0.08)] dark:[--dash-streak-metric-bg:rgba(15,23,42,0.72)] dark:[--dash-streak-metric-border:rgba(94,234,212,0.18)] dark:[--dash-streak-metric-shadow:0_10px_24px_rgba(0,0,0,0.22)] dark:[--dash-teal-strong:#5eead4]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: "var(--ui-muted)" }}
          >
            {now.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1
            className="text-2xl sm:text-[28px] font-bold tracking-tight"
            style={{ color: "var(--ui-heading)" }}
          >
            {greeting}, {displayName} 👋
          </h1>
          <p className="text-sm" style={{ color: "var(--ui-muted)" }}>
            {error ? (
              <>We couldn&apos;t load your overview right now.</>
            ) : (
              <>
                You have{" "}
                <span style={{ color: "#6EE7D8", fontWeight: 600 }}>
                  {loading ? "…" : taskPending} tasks
                </span>{" "}
                pending — keep the momentum going.
              </>
            )}
          </p>
        </div>

        <Link
          href="/dashboard/study-planner"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 self-start sm:self-auto flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
            color: "#0d2420",
            boxShadow: "0 3px 14px rgba(110,231,216,0.28)",
          }}
          onMouseEnter={handlePrimaryCtaEnter}
          onMouseLeave={handlePrimaryCtaLeave}
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
              strokeWidth={2.2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Task
        </Link>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.10em]"
            style={{ color: "var(--ui-muted)" }}
          >
            Overview
          </p>
          <div
            className="flex-1 h-px"
            style={{ background: "rgba(110,231,216,0.07)" }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {overviewCards.map((card) => {
            const isCardDisabled = card.title === "AI Doubt Solver" && !isAiActive;
            
            const cardContent = (
              <>
                <div className="flex items-start justify-between">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${card.accent}14`,
                      color: card.accent,
                      border: `1px solid ${card.accent}22`,
                    }}
                  >
                    {card.icon}
                  </div>
                  {!isCardDisabled && (
                    <svg
                      className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity duration-200 mt-0.5"
                      style={{ color: card.accent }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.2}
                        d="M7 17L17 7M17 7H7M17 7v10"
                      />
                    </svg>
                  )}
                </div>

                <div className="space-y-0.5">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    {card.title}
                  </p>
                  <p
                    className="text-xl font-bold leading-tight"
                    style={{ color: "var(--ui-heading)" }}
                  >
                    {card.value}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--ui-muted)" }}>
                    {card.sub}
                  </p>
                </div>

                <p
                  className="text-[10px] font-medium truncate"
                  style={{ color: card.deltaPositive ? card.accent : "#f87171" }}
                >
                  {card.delta}
                </p>
              </>
            );

            if (isCardDisabled) {
              return (
                <div
                  key={card.title}
                  className="group flex flex-col gap-3.5 p-4 rounded-2xl"
                  style={{
                    background: "var(--ui-surface)",
                    border: "1px solid var(--ui-border)",
                    boxShadow:
                      "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)",
                    opacity: 0.6,
                    cursor: "not-allowed",
                  }}
                >
                  {cardContent}
                </div>
              );
            }

            return (
              <Link
                key={card.title}
                href={card.href}
                className="group flex flex-col gap-3.5 p-4 rounded-2xl transition-all duration-200"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid var(--ui-border)",
                  boxShadow:
                    "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${card.accent}40`;
                  el.style.boxShadow = `0 6px 22px rgba(0,0,0,0.32), 0 0 18px ${card.accent}12`;
                  el.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(110,231,216,0.11)";
                  el.style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)";
                  el.style.transform = "translateY(0)";
                }}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>
      </section>

      <section
        className="relative overflow-hidden rounded-2xl border border-teal-700/20 bg-[linear-gradient(135deg,rgba(240,253,250,0.98)_0%,rgba(204,251,241,0.78)_42%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_18px_46px_rgba(15,118,110,0.14),inset_0_1px_0_rgba(255,255,255,0.78)] transition-colors duration-300 sm:p-6 dark:border-teal-200/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.96)_48%,rgba(20,83,78,0.42)_100%)] dark:shadow-[0_18px_46px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(94,234,212,0.10)]"
      >
        <div
          className="absolute inset-x-6 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(20,184,166,0.44), transparent)",
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                streakCount >= 7
                  ? "animate-pulse"
                  : streakCount > 0
                    ? "animate-pulse"
                    : ""
              }`}
              style={{
                background:
                  streakCount > 0
                    ? "linear-gradient(135deg, rgba(255,247,237,0.96), rgba(204,251,241,0.82))"
                    : "linear-gradient(135deg, #6EE7D8, #14B8A6)",
                color: "#0d2420",
                boxShadow:
                  streakCount > 0
                    ? flameGlow
                    : "0 10px 24px rgba(20,184,166,0.24)",
              }}
            >
              <span
                className={`text-2xl sm:text-3xl leading-none ${
                  streakCount >= 7 ? "scale-110" : ""
                }`}
                aria-hidden="true"
              >
                🔥
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: "var(--dash-teal-strong)" }}
                >
                  Study Streak
                </p>
                {streakBadge && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: streakBadge.background,
                      border: `1px solid ${streakBadge.tone}33`,
                      color: streakBadge.tone,
                      boxShadow: `0 8px 18px ${streakBadge.glow}`,
                    }}
                  >
                    {streakBadge.label} badge
                  </span>
                )}
              </div>
              <h2
                className="text-xl sm:text-2xl font-bold mt-1"
                style={{ color: "var(--ui-heading)" }}
              >
                {loading
                  ? "Checking your momentum..."
                  : streak?.current_streak
                    ? `${streak.current_streak} day${streak.current_streak === 1 ? "" : "s"} in a row`
                    : "Complete a task to start today"}
              </h2>
              <p
                className="text-sm mt-1 max-w-2xl"
                style={{ color: "var(--ui-muted)" }}
              >
                {streakMotivation}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--ui-subtle)" }}
              >
                {error
                  ? "Streak details are unavailable right now."
                  : streak?.last_active_date
                    ? `Last active: ${streakLastActive}`
                    : "Your first completed study task will count as day 1."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
            {streakMetricItems.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3 min-w-0 transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  background: "var(--dash-streak-metric-bg)",
                  border: "1px solid var(--dash-streak-metric-border)",
                  boxShadow: "var(--dash-streak-metric-shadow)",
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide truncate"
                  style={{ color: "var(--dash-teal-strong)" }}
                >
                  {label}
                </p>
                <p
                  className="text-base sm:text-lg font-bold mt-1 truncate"
                  style={{ color: "var(--ui-heading)" }}
                  title={value}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="rounded-2xl p-5 transition-colors duration-300 sm:p-6"
        style={{
          background: "var(--ui-surface)",
          border: "1px solid var(--ui-border)",
          boxShadow: "var(--dash-panel-shadow)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "var(--dash-teal-strong)" }}
            >
              Weekly Progress
            </p>
            <h2
              className="text-lg sm:text-xl font-bold mt-1"
              style={{ color: "var(--ui-heading)" }}
            >
              Last 7 days of completed tasks
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--ui-muted)" }}>
              {weeklySummary}
            </p>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold self-start"
            style={{
              background: "rgba(110,231,216,0.12)",
              border: "1px solid rgba(20,184,166,0.18)",
              color: "var(--dash-teal-strong)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: weeklyHasProgress ? "#14B8A6" : "#99f6e4",
                boxShadow: weeklyHasProgress
                  ? "0 0 10px rgba(20,184,166,0.45)"
                  : "none",
              }}
            />
            Study tasks
          </div>
        </div>

        <div
          className="rounded-2xl border border-teal-700/15 bg-[linear-gradient(180deg,rgba(240,253,250,0.62),rgba(255,255,255,0.72))] p-4 transition-colors duration-300 sm:p-5 dark:border-teal-200/15 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.70),rgba(17,24,39,0.88))]"
        >
          <WeeklyProgressChart
            loading={loading}
            weeklyProgress={weeklyProgress}
            weeklyProgressError={weeklyProgressError}
            weeklyHasProgress={weeklyHasProgress}
            weeklyMax={weeklyMax}
          />
        </div>
      </section>

      {(!loading || generatedInsights || aiInsightsLoading) && (
        <section
          className="relative overflow-hidden rounded-2xl border border-teal-700/20 bg-[linear-gradient(135deg,rgba(240,253,250,0.98)_0%,rgba(204,251,241,0.78)_42%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_18px_46px_rgba(15,118,110,0.14),inset_0_1px_0_rgba(255,255,255,0.78)] transition-colors duration-300 sm:p-6 dark:border-teal-200/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.96)_48%,rgba(20,83,78,0.42)_100%)] dark:shadow-[0_18px_46px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(94,234,212,0.10)]"
        >
          <div
            className="absolute inset-x-6 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(20,184,166,0.44), transparent)",
            }}
          />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(110,231,216,0.14)",
                  color: "#6EE7D8",
                  border: "1px solid rgba(110,231,216,0.22)",
                }}
              >
                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: "var(--dash-teal-strong)" }}
                >
                  AI Copilot
                </p>
                <h2
                  className="text-lg sm:text-xl font-bold"
                  style={{ color: "var(--ui-heading)" }}
                >
                  Proactive Productivity Insights
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => generateAiInsights(true)}
              disabled={aiInsightsLoading || aiInsightsTyping || !isAiActive}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 self-start sm:self-auto"
              style={{
                background: isAiActive && !aiInsightsLoading && !aiInsightsTyping
                  ? "linear-gradient(135deg,#6EE7D8,#14B8A6)"
                  : "rgba(255,255,255,0.06)",
                color: isAiActive && !aiInsightsLoading && !aiInsightsTyping ? "#111827" : "var(--ui-subtle)",
                boxShadow: isAiActive && !aiInsightsLoading && !aiInsightsTyping
                  ? "0 4px 12px rgba(110,231,216,0.22)"
                  : "none",
                cursor: isAiActive && !aiInsightsLoading && !aiInsightsTyping ? "pointer" : "not-allowed",
                opacity: isAiActive ? 1 : 0.5,
              }}
            >
              {aiInsightsLoading ? (
                <>
                  <span className="w-3 h-3 border-2 border-teal-800 border-t-transparent rounded-full animate-spin" />
                  Thinking...
                </>
              ) : aiInsightsTyping ? (
                "Typing..."
              ) : (
                "Refresh Analysis"
              )}
            </button>
          </div>

          {aiInsightsLoading && !generatedInsights && (
            <div className="space-y-2.5 p-4 rounded-xl animate-pulse" style={{ background: "rgba(110,231,216,0.04)" }}>
              <div className="h-4 w-32 rounded bg-teal-500/10 animate-pulse" />
              <div className="h-3.5 w-full rounded bg-teal-500/5 animate-pulse" />
              <div className="h-3.5 w-5/6 rounded bg-teal-500/5 animate-pulse" />
              <div className="h-3.5 w-4/5 rounded bg-teal-500/5 animate-pulse" />
            </div>
          )}

          {aiInsightsError && (
            <div
              className="rounded-xl p-3.5 text-sm"
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.18)",
                color: "var(--dash-danger)",
              }}
            >
              {aiInsightsError}
            </div>
          )}

          {generatedInsights && (
            <div
              className="rounded-xl p-4.5 transition-all duration-300"
              style={{
                background: "rgba(110,231,216,0.04)",
                border: "1px solid rgba(110,231,216,0.11)",
              }}
            >
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-100 font-normal">
                {generatedInsights}
                {aiInsightsTyping && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-teal-400 animate-pulse align-middle" />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* AI Recommendations Card */}
      {!loading && <RecommendationsSection />}

      <div className="grid lg:grid-cols-5 gap-5">
        <div
          className="lg:col-span-3 rounded-2xl p-5"
          style={{
            background: "var(--ui-surface)",
            border: "1px solid var(--ui-border)",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--ui-heading)", letterSpacing: "-0.01em" }}
              >
                Today&apos;s Focus
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--ui-muted)" }}
              >
                {focusSummary}
              </p>
            </div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                background:
                  progressPct === 100
                    ? "rgba(110,231,216,0.14)"
                    : "rgba(110,231,216,0.07)",
                color: "#6EE7D8",
                border: "1px solid rgba(110,231,216,0.16)",
              }}
            >
              {loading ? "—" : `${progressPct}%`}
            </span>
          </div>

          <div
            className="w-full h-1.5 rounded-full mb-4"
            style={{ background: "var(--ui-surface-2)" }}
          >
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #6EE7D8, #14B8A6)",
                boxShadow:
                  progressPct > 0 ? "0 0 10px rgba(110,231,216,0.30)" : "none",
              }}
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              focusSkeletonRows.map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
                  style={{ background: "var(--ui-surface-2)" }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: "rgba(110,231,216,0.08)" }}
                  />
                  <div
                    className="flex-1 h-3 rounded"
                    style={{ background: "var(--ui-surface-2)" }}
                  />
                  <div
                    className="h-4 w-12 rounded"
                    style={{ background: "var(--ui-surface-2)" }}
                  />
                </div>
              ))
            ) : error ? (
              <div
                className="text-xs py-2"
                style={{ color: "var(--ui-muted)" }}
              >
                Couldn&apos;t load tasks right now.
              </div>
            ) : focusItems.length ? (
              focusItems.map((task, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors duration-150"
                  style={{
                    background: task.done
                      ? "rgba(110,231,216,0.04)"
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                    style={{
                      borderColor: task.done
                        ? "#6EE7D8"
                        : "rgba(110,231,216,0.22)",
                      background: task.done ? "#6EE7D8" : "transparent",
                    }}
                  >
                    {task.done && (
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="#0d2420"
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
                  </div>
                  <span
                    className={`text-sm flex-1 truncate ${task.done ? "line-through" : ""}`}
                    style={{
                      color: task.done
                        ? "var(--ui-subtle)"
                        : "var(--ui-heading)",
                    }}
                  >
                    {task.label}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={priorityStyle(task.priority)}
                  >
                    {task.priority}
                  </span>
                </div>
              ))
            ) : (
              <div
                className="text-xs py-2"
                style={{ color: "var(--ui-muted)" }}
              >
                No tasks yet — create one to see it here.
              </div>
            )}
          </div>

          <Link
            href="/dashboard/study-planner"
            className="mt-4 flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
            style={{ color: "#0d9488" }}
            onMouseEnter={handleTextLinkEnter}
            onMouseLeave={handleTextLinkLeave}
          >
            View all tasks
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--ui-surface)",
              border: "1px solid var(--ui-border)",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)",
            }}
          >
            <h2
              className="text-sm font-semibold mb-3.5"
              style={{ color: "var(--ui-heading)", letterSpacing: "-0.01em" }}
            >
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium transition-all duration-150"
                  style={{
                    background: "rgba(110,231,216,0.04)",
                    border: "1px solid var(--ui-border)",
                    color: "var(--ui-text)",
                  }}
                  onMouseEnter={handleQuickActionEnter}
                  onMouseLeave={handleQuickActionLeave}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(110,231,216,0.10)",
                      color: "#6EE7D8",
                    }}
                  >
                    {action.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate leading-tight">
                      {action.label}
                    </p>
                    <p
                      className="text-[10px] leading-tight mt-0.5 truncate"
                      style={{ color: "var(--ui-muted)" }}
                    >
                      {action.details}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Today's Schedule Card */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--ui-surface)",
              border: "1px solid var(--ui-border)",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--ui-heading)", letterSpacing: "-0.01em" }}
              >
                Today&apos;s Schedule
              </h2>
              <Link
                href="/dashboard/timetable"
                className="text-xs transition-colors font-medium"
                style={{ color: "#6EE7D8" }}
              >
                Open Timetable →
              </Link>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-xs text-[var(--ui-muted)]">Loading schedule...</div>
              ) : todaySlots.length === 0 ? (
                <div className="text-xs text-[var(--ui-muted)] py-4 text-center border border-dashed border-[var(--ui-border)] rounded-xl">
                  No classes scheduled for today.
                </div>
              ) : (
                todaySlots.map((slot, idx) => {
                  const colors = {
                    teal: { bg: "rgba(110,231,216,0.06)", border: "rgba(110,231,216,0.18)", text: "#6EE7D8", dot: "#14B8A6" },
                    purple: { bg: "rgba(139,92,246,0.06)", border: "rgba(139,92,246,0.18)", text: "#a78bfa", dot: "#8b5cf6" },
                    indigo: { bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.18)", text: "#818cf8", dot: "#6366f1" },
                    amber: { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)", text: "#fbbf24", dot: "#f59e0b" },
                    rose: { bg: "rgba(244,63,94,0.06)", border: "rgba(244,63,94,0.18)", text: "#fb7185", dot: "#f43f5e" },
                    emerald: { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.18)", text: "#34d399", dot: "#10b981" },
                  };
                  const theme = colors[slot.color as "teal"] || colors.teal;
                  const hStrStart = slot.start_time;
                  const [hStart, mStart] = hStrStart.split(":").map(Number);
                  const ampmStart = hStart >= 12 ? "PM" : "AM";
                  const displayHourStart = hStart % 12 || 12;
                  const formattedTime = `${displayHourStart}:${String(mStart).padStart(2, "0")} ${ampmStart}`;

                  return (
                    <div
                      key={slot.id || idx}
                      className="flex items-center justify-between p-3 rounded-xl border transition-all"
                      style={{
                        background: "rgba(255,255,255,0.01)",
                        borderColor: "var(--ui-border)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = theme.border;
                        e.currentTarget.style.background = theme.bg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--ui-border)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.01)";
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.dot }} />
                          <p className="text-xs font-bold text-[var(--ui-heading)] truncate">{slot.subject}</p>
                        </div>
                        <p className="text-[10px] text-[var(--ui-muted)] mt-0.5 ml-3.5">
                          ⏰ {formattedTime} {slot.location ? `• 📍 ${slot.location}` : ""}
                        </p>
                      </div>
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase"
                        style={{
                          background: theme.bg,
                          color: theme.text,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        {slot.color}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            className="rounded-2xl p-5 flex-1"
            style={{
              background: "var(--ui-surface)",
              border: "1px solid var(--ui-border)",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.14)",
            }}
          >
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--ui-heading)", letterSpacing: "-0.01em" }}
            >
              Recent Activity
            </h2>
            <div className="space-y-3.5">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      background: item.tagColor ?? "#6EE7D8",
                      boxShadow: `0 0 6px ${item.tagColor ?? "#6EE7D8"}60`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs leading-snug"
                      style={{ color: "var(--ui-heading)" }}
                    >
                      {item.text}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.time && (
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--ui-muted)" }}
                        >
                          {item.time}
                        </span>
                      )}
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          background: `${item.tagColor ?? "#6EE7D8"}12`,
                          color: item.tagColor ?? "#6EE7D8",
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
