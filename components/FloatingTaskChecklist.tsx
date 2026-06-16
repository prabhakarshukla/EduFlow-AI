// components/FloatingTaskChecklist.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { GoChecklist } from "react-icons/go";
import { CheckSquare, ChevronDown, ChevronUp, GripVertical, Plus, Trash2, X } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  status: string;
  priority?: number;
  completed_at: string | null;
};

export default function FloatingTaskChecklist() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visible, setVisible] = useState(false);

  const getTasks = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("study_tasks")
      .select("id, title, status, priority, completed_at, created_at")
      .eq("user_id", user.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      const filteredTasks = data.filter((task) => {
        // Always show pending tasks
        if (task.status !== "done") return true;

        // Hide if completed_at missing
        if (!task.completed_at) return false;

        // Show completed task only for 24h
        const completedTime = new Date(task.completed_at).getTime();

        const now = Date.now();

        const hoursPassed = (now - completedTime) / (1000 * 60 * 60);

        return hoursPassed <= 24;
      });

      setTasks(filteredTasks);
    }
  }, []);

  // Fetch fresh tasks whenever popup opens
  useEffect(() => {
    if (visible) {
      getTasks();
    }
  }, [visible, getTasks]);

  async function toggleTask(taskId: string, checked: boolean) {
    const newStatus = checked ? "done" : "todo";

    // Instant UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completed_at: checked ? new Date().toISOString() : null,
            }
          : t,
      ),
    );

    // Database update
    await supabase
      .from("study_tasks")
      .update({
        status: newStatus,
        completed_at: checked ? new Date().toISOString() : null,
      })
      .eq("id", taskId);
  }

  function getPriorityStyles(priority?: number) {
    if (priority === 3) {
      return {
        border: "border-red-400/30 bg-red-500/5",
        badge: "bg-red-500/15 text-red-300 border border-red-400/20",
      };
    }

    if (priority === 2) {
      return {
        border: "border-amber-400/30 bg-amber-500/5",
        badge: "bg-amber-500/15 text-amber-300 border border-amber-400/20",
      };
    }

    return {
      border: "border-emerald-400/20 bg-emerald-500/[0.03]",
      badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
    };
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => {
          setVisible((prev) => !prev);
        }}
        className="fixed bottom-6 right-6 z-[1000] flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500 to-teal-500 text-2xl text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 hover:scale-105 hover:shadow-[0_14px_35px_rgba(16,185,129,0.35)]"
      >
        <CheckSquare />
      </button>

      {/* Popup */}
      {visible && (
        <div className="fixed bottom-24 right-6 z-[1000] max-h-[65vh] w-[340px] overflow-y-auto rounded-2xl border border-teal-400/40 bg-gradient-to-b from-[#071226] to-[#0f172a] p-5 shadow-[0_0_0_1px_rgba(45,212,191,0.12),0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-emerald-100">My Tasks</h3>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {tasks.filter((task) => task.status !== "done").length} Pending
            </span>
          </div>

          {/* Task List */}
          <ul className="space-y-3">
            {tasks.length === 0 && (
              <li className="py-4 text-center text-sm text-slate-500">
                No tasks found.
              </li>
            )}

            {tasks.map((task) => {
              const styles = getPriorityStyles(task.priority);

              return (
                <li
                  key={task.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${styles.border} ${
                    task.status === "done" ? "opacity-70" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={task.status === "done"}
                    onChange={(e) => toggleTask(task.id, e.target.checked)}
                    className="mt-1 h-4 w-4 cursor-pointer accent-emerald-500"
                  />

                  {/* Task Content */}
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <p
                      className={`break-words text-sm leading-relaxed ${
                        task.status === "done"
                          ? "text-slate-500 line-through"
                          : "text-slate-100"
                      }`}
                    >
                      {task.title}
                    </p>

                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        task.priority === 3
                          ? "border border-red-400/30 bg-red-500/10 text-red-300"
                          : task.priority === 2
                            ? "border border-amber-400/30 bg-amber-500/10 text-amber-300"
                            : "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {task.priority === 3
                        ? "H"
                        : task.priority === 2
                          ? "M"
                          : "L"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
