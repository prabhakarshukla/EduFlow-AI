"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface StatsData {
  totalFocusTime: number;
  todayFocusTime: number;
  weeklyFocusTime: number;
  sessionsCompleted: number;
  averageDuration: number;
  currentStreak: number;
}

export default function FocusStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setLoading(false);
          return;
        }

        const tzOffsetMinutes = new Date().getTimezoneOffset();

        const { data, error } = await supabase.rpc("get_focus_stats", {
          p_user_id: userData.user.id,
          p_tz_offset_minutes: tzOffsetMinutes,
        });

        if (error) {
          console.error("Error fetching focus stats:", error);
        } else if (data) {
          setStats(data as StatsData);
        }
      } catch (err) {
        console.error("Failed to fetch focus stats", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="h-10 bg-[var(--ui-hover)] rounded-lg"></div>
        <div className="h-10 bg-[var(--ui-hover)] rounded-lg"></div>
        <div className="h-10 bg-[var(--ui-hover)] rounded-lg"></div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-sm text-[var(--ui-muted)]">Unable to load statistics.</div>;
  }

  const formatHrsMins = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const statItems = [
    { label: "Today", value: formatHrsMins(stats.todayFocusTime) },
    { label: "This Week", value: formatHrsMins(stats.weeklyFocusTime) },
    { label: "Total Focused", value: formatHrsMins(stats.totalFocusTime) },
    { label: "Sessions", value: stats.sessionsCompleted.toString() },
    { label: "Avg Session", value: formatHrsMins(Math.round(stats.averageDuration)) },
    { label: "Current Streak", value: `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {statItems.map((item, idx) => (
        <div key={idx} className="bg-[var(--ui-hover)] p-3 rounded-xl border border-[var(--ui-border)] flex flex-col justify-center">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ui-muted)] mb-1">
            {item.label}
          </span>
          <span className="text-lg font-bold text-[#14b8a6]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
