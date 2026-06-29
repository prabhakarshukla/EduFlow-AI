import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { routeAgent } from "@/lib/ai/agents/agent-router";

// ---------- Types ----------
type Recommendation = {
  type: string;
  title: string;
  message: string;
  reason: string;
  priority: "high" | "medium" | "low";
  actionLabel: string;
  actionHref: string;
};

type DbTask = {
  id: string;
  title: string | null;
  details: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type DbMood = {
  id: string;
  mood: number;
  note: string | null;
  occurred_at: string;
};

type DbProductivity = {
  duration_minutes: number;
  session_date: string;
  subject: string | null;
};

type DbDoubt = {
  id: string;
  question: string | null;
  topic: string | null;
  created_at: string | null;
};

type DbStreak = {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
};

// ---------- Helpers ----------

function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key);
}

function safeJsonParse(text: string): Recommendation[] | null {
  // Strip potential markdown fences
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
  }

  // Find JSON array boundaries
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;

    // Validate shape
    return parsed
      .filter(
        (item: unknown): item is Recommendation =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).type === "string" &&
          typeof (item as Record<string, unknown>).title === "string" &&
          typeof (item as Record<string, unknown>).message === "string",
      )
      .slice(0, 5);
  } catch {
    return null;
  }
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(dateKey1: string, dateKey2: string): number {
  const d1 = new Date(dateKey1);
  const d2 = new Date(dateKey2);
  return Math.round(Math.abs(d1.getTime() - d2.getTime()) / (24 * 60 * 60 * 1000));
}

// ---------- Route ----------

export async function POST(req: Request) {
    
  try {
    // Extract auth header so we know who the user is
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    const supabase = createServerSupabase();

    // Try to get user from authorization header token
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    // Fallback: accept userId from body (for client-side calls that send userId)
    if (!userId) {
      try {
        const body = await req.clone().json();
        userId = body?.userId ?? null;
      } catch {
        // body may not be JSON
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    // ---------- Fetch all user data in parallel ----------
    const today = toLocalDateKey(new Date());

    const [
      tasksRes,
      recentDoneTasksRes,
      streakRes,
      moodRes,
      recentMoodsRes,
      productivityRes,
      doubtsRes,
    ] = await Promise.all([
      // All tasks
      supabase
        .from("study_tasks")
        .select("id,title,details,status,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),

      // Recently completed tasks
      supabase
        .from("study_tasks")
        .select("id,title,details,status,created_at,updated_at")
        .eq("user_id", userId)
        .eq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(20),

      // Streak
      supabase
        .from("streaks")
        .select("current_streak,longest_streak,last_active_date")
        .eq("user_id", userId)
        .maybeSingle(),

      // Latest mood
      supabase
        .from("mood_entries")
        .select("id,mood,note,occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Recent moods (last 7)
      supabase
        .from("mood_entries")
        .select("id,mood,note,occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(7),

      // Productivity sessions
      supabase
        .from("productivity_sessions")
        .select("duration_minutes,session_date,subject")
        .eq("user_id", userId)
        .order("session_date", { ascending: false })
        .limit(30),

      // Doubt history
      supabase
        .from("doubt_history")
        .select("id,question,topic,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    // ---------- Build context object ----------
    const allTasks = (tasksRes.data ?? []) as DbTask[];
    const doneTasks = (recentDoneTasksRes.data ?? []) as DbTask[];
    const pendingTasks = allTasks.filter((t) => t.status !== "done");
    const streak = (streakRes.data as DbStreak | null) ?? null;
    const latestMood = (moodRes.data as DbMood | null) ?? null;
    const recentMoods = (recentMoodsRes.data ?? []) as DbMood[];
    const productivity = (productivityRes.data ?? []) as DbProductivity[];
    const doubts = (doubtsRes.data ?? []) as DbDoubt[];

    // Compute productivity stats
    const totalStudyMinutes = productivity.reduce(
      (s, r) => s + Number(r.duration_minutes ?? 0),
      0,
    );
    const todayMinutes = productivity
      .filter((r) => r.session_date === today)
      .reduce((s, r) => s + Number(r.duration_minutes ?? 0), 0);
    const avgSessionMinutes = productivity.length
      ? Math.round(totalStudyMinutes / productivity.length)
      : 0;

    // Identify unique subjects from tasks and productivity sessions
    const subjectSet = new Set<string>();
    allTasks.forEach((t) => {
      if (t.title) subjectSet.add(t.title);
    });
    productivity.forEach((p) => {
      if (p.subject) subjectSet.add(p.subject);
    });

    // Doubt frequency analysis
    const doubtTopics: Record<string, number> = {};
    doubts.forEach((d) => {
      const topic = d.topic || "general";
      doubtTopics[topic] = (doubtTopics[topic] ?? 0) + 1;
    });

    // Streak risk detection
    const streakAtRisk =
      streak &&
      streak.current_streak > 0 &&
      streak.last_active_date &&
      streak.last_active_date !== today &&
      daysBetween(streak.last_active_date, today) >= 1;

    // Average mood
    const avgMood = recentMoods.length
      ? Math.round(
          (recentMoods.reduce((s, m) => s + m.mood, 0) / recentMoods.length) *
            10,
        ) / 10
      : null;

    const contextData = {
      source: "recommendations",
      today,
      tasks: {
        total: allTasks.length,
        completed: doneTasks.length,
        pending: pendingTasks.length,
        recentPendingTitles: pendingTasks
          .slice(0, 8)
          .map((t) => t.title || t.details || "Untitled"),
        recentCompletedTitles: doneTasks
          .slice(0, 5)
          .map((t) => t.title || t.details || "Untitled"),
        subjects: Array.from(subjectSet).slice(0, 10),
      },
      streak: streak
        ? {
            currentStreak: streak.current_streak,
            longestStreak: streak.longest_streak,
            lastActiveDate: streak.last_active_date,
            atRisk: streakAtRisk,
            daysSinceLastActive: streak.last_active_date
              ? daysBetween(streak.last_active_date, today)
              : null,
          }
        : null,
      mood: {
        latest: latestMood
          ? { value: latestMood.mood, note: latestMood.note, at: latestMood.occurred_at }
          : null,
        average: avgMood,
        recentTrend: recentMoods.slice(0, 5).map((m) => m.mood),
      },
      productivity: {
        totalSessions: productivity.length,
        totalMinutes: totalStudyMinutes,
        todayMinutes,
        avgSessionMinutes,
        recentSessionDates: productivity.slice(0, 7).map((p) => p.session_date),
        recentSubjects: productivity
          .filter((p) => p.subject)
          .slice(0, 10)
          .map((p) => p.subject),
      },
      doubts: {
        totalQuestions: doubts.length,
        recentQuestions: doubts.slice(0, 5).map((d) => d.question || ""),
        topicFrequency: doubtTopics,
      },
    };

    // ---------- Call recommendation agent ----------
    const userMessage =
      "Based on all the student data below, generate 3-5 personalized, actionable study recommendations. " +
      "Return ONLY a JSON array (no markdown fences). " +
      "Use specific numbers, task names, and dates from the provided context.";

    const aiResponse = await routeAgent({
      agentType: "recommendation",
      userMessage,
      context: contextData,
    });

    if (!aiResponse?.trim()) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 },
      );
    }

    const recommendations = safeJsonParse(aiResponse);

    if (!recommendations || recommendations.length === 0) {
      // Fallback: return the raw text so the client can still show something
      return NextResponse.json({
        recommendations: [],
        rawInsight: aiResponse,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      recommendations,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[recommendations] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error generating recommendations.",
      },
      { status: 500 },
    );
  }
}
