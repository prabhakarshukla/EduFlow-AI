"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import FloatingTaskChecklist from "../../components/FloatingTaskChecklist";

const sidebarLinks = [
  {
    group: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      },
    ],
  },
  {
    group: "Tools",
    items: [
      {
        label: "Study Planner",
        href: "/dashboard/study-planner",
        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
      },
      {
        label: "Weekly Timetable",
        href: "/dashboard/timetable",
        icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      },
      {
        label: "Study Rooms",
        href: "/dashboard/study-rooms",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
      },
      {
        label: "AI Recommender", 
        href: "/dashboard/ai_recommender",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
      },
      {
        label: "AI Doubt Solver",
        href: "/dashboard/doubt-solver",
        icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
      },
      {
        label: "Notes",
        href: "/dashboard/notes",
        icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
      },
      {
        label: "Productivity",
        href: "/dashboard/productivity",
        icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
      },
      {
        label: "Mood Tracker",
        href: "/dashboard/mood",
        icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      }
    ],
  },
  {
    group: "Account",
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      },
    ],
  },
];

const allLinks = sidebarLinks.flatMap((g) => g.items);

const resolveDisplayName = (
  user: {
    email?: string | null;
    user_metadata?: {
      full_name?: unknown;
      name?: unknown;
    } | null;
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const lastProfileSyncUserId = useRef<string | null>(null);

  const currentPage =
    allLinks.find((l) => l.href === pathname)?.label ?? "Dashboard";
  const nextPathForLogin = useMemo(
    () => `/auth/login?next=${encodeURIComponent(pathname || "/dashboard")}`,
    [pathname],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { account } = await import("../../lib/appwrite");
        const appwriteUser = await account.get();
        if (!mounted) return;
        
        // Map Appwrite user to the User type expected by the layout
        const mappedUser = {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          user_metadata: {
            full_name: appwriteUser.name,
          }
        } as unknown as User;
        
        setUser(mappedUser);
        setAuthReady(true);
      } catch (err) {
        if (!mounted) return;
        setAuthReady(true);
        router.replace(nextPathForLogin);
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      if (!data.session?.user) router.replace(nextPathForLogin);
    })();

    return () => {
      mounted = false;
    };
  }, [router, nextPathForLogin]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (lastProfileSyncUserId.current === user.id) return;
    lastProfileSyncUserId.current = user.id;

    const fullName = resolveDisplayName(user);
    const avatarUrl =
      (user.user_metadata?.avatar_url as string | undefined) ||
      (user.user_metadata?.picture as string | undefined) ||
      null;

    const basePayload = {
      id: user.id,
      ...(fullName ? { full_name: fullName } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };

    (async () => {
      try {
        const richPayload = {
          ...basePayload,
          user_id: user.id,
          email: user.email ?? null,
        } as Record<string, unknown>;

        const { error: richError } = await supabase
          .from("profiles")
          .upsert(richPayload, { onConflict: "id" });

        if (!richError) return;

        await supabase
          .from("profiles")
          .upsert(basePayload, { onConflict: "id" });
      } catch {
      }
    })();
  }, [authReady, user]);

  const displayEmail = user?.email ?? "";
  const displayName = resolveDisplayName(user);
  const avatarLetter = (
    displayName?.trim()?.[0] ??
    displayEmail?.trim()?.[0] ??
    "S"
  ).toUpperCase();

  const handleLogout = async () => {
    try {
      const { account } = await import("../../lib/appwrite");
      await account.deleteSession("current");
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--ui-bg)" }}
    >
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:relative z-30 flex flex-col h-screen flex-shrink-0
          transition-all duration-300 ease-in-out
          ${mobileOpen ? "left-0" : "-left-64 md:left-0"}
        `}
        style={{
          top: "px",
          height: "100vh",
          width: collapsed ? "64px" : "224px",
          background: "var(--ui-surface)",
          borderRight: "1px solid var(--ui-border)",
        }}
      >
        <div
          className={`flex items-center ${!collapsed ? "justify-between" : "justify-center"} px-3 py-3 flex-shrink-0`}
          style={{ borderBottom: "1px solid var(--ui-border)", minHeight: "52px", position: "relative" }}
        >
          {!collapsed ? (
            <>
              <Link href="/" className="flex items-center gap-2 px-1 flex-shrink-0">
                <img
                  src="/images/logo.png"
                  alt="EduFlow AI"
                  style={{
                    height: "28px",
                    width: "auto",
                    display: "block",
                  }}
                />
              </Link>
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-lg transition-all duration-150"
                style={{ color: "var(--ui-muted)" }}
                aria-label="Collapse sidebar"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#14b8a6";
                  (e.currentTarget as HTMLElement).style.background = "#f5f7f4";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--ui-muted)";
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
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
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            </>
          ) : (
            <>
              <div className="w-full flex justify-center py-0.5">
                <Link href="/">
                  <img
                    src="/images/logo.png"
                    alt="EduFlow AI"
                    style={{
                      height: "20px",
                      width: "auto",
                      display: "block",
                      maxWidth: "40px",
                      objectFit: "contain",
                    }}
                  />
                </Link>
              </div>
              <button
                onClick={() => setCollapsed(false)}
                className="absolute -right-3 top-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150"
                style={{
                  background: "var(--ui-surface)",
                  border: "1px solid var(--ui-border)",
                  color: "#14b8a6",
                  zIndex: 10,
                }}
                aria-label="Expand sidebar"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        <nav className="flex flex-col flex-1 px-2 py-4 gap-5 overflow-y-auto overflow-x-hidden">
          {sidebarLinks.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-0.5">
              {!collapsed && (
                <p
                  className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: "var(--ui-muted)" }}
                >
                  {group}
                </p>
              )}

              {items.map(({ label, href, icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                    style={{
                      color: active ? "#14b8a6" : "var(--ui-text)",
                      background: active ? "var(--ui-active-bg)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color =
                          "#14b8a6";
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--ui-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--ui-text)";
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                      }
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{
                          background:
                            "linear-gradient(180deg, #6EE7D8, #14B8A6)",
                        }}
                      />
                    )}
                    <svg
                      className="w-[18px] h-[18px] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={active ? 2.1 : 1.65}
                        d={icon}
                      />
                    </svg>
                    {!collapsed && (
                      <span className="truncate leading-normal">{label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          className="flex-shrink-0 px-3 py-4"
          style={{ borderTop: "1px solid var(--ui-border)" }}
        >
          {collapsed ? (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto"
              style={{
                background: "linear-gradient(135deg,#6EE7D8,#14B8A6)",
                color: "#0d2420",
              }}
            >
              {avatarLetter}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg,#6EE7D8,#14B8A6)",
                  color: "#0d2420",
                }}
              >
                {avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold truncate leading-tight"
                  style={{ color: "var(--ui-text)" }}
                >
                  {displayName}
                </p>
                <p
                  className="text-[10px] truncate leading-tight mt-0.5"
                  style={{ color: "var(--ui-muted)" }}
                >
                  {displayEmail || " "}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={!authReady}
                title="Log out"
                className="p-1.5 rounded-lg transition-all duration-150 flex-shrink-0"
                style={{ color: "var(--ui-muted)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#ef4444";
                  (e.currentTarget as HTMLElement).style.background = "#fef2f2";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--ui-muted)";
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      <FloatingTaskChecklist />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="flex-shrink-0 flex items-center gap-4 px-5 sm:px-7"
          style={{
            borderBottom: "1px solid var(--ui-border)",
            background: "color-mix(in srgb, var(--ui-bg) 95%, transparent)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            minHeight: "56px",
          }}
        >
          <button
            className="md:hidden p-1.5 rounded-lg transition-colors duration-150"
            style={{ color: "#14b8a6" }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
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
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <span style={{ color: "var(--ui-muted)", fontWeight: 500 }}>EduFlow</span>
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: "#9ca3af" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span
              className="font-semibold truncate"
              style={{ color: "var(--ui-text)" }}
            >
              {currentPage}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-text transition-colors duration-150"
              style={{
                background: "var(--ui-surface)",
                border: "1px solid var(--ui-border)",
                color: "var(--ui-muted)",
                minWidth: "160px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#14b8a6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--ui-border)";
              }}
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
                />
              </svg>
              <span>Search…</span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: "var(--ui-hover)", color: "var(--ui-muted)" }}
              >
                ⌘K
              </span>
            </div>

            <button
              className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center transition-all duration-150"
              style={{
                color: "var(--ui-muted)",
                background: "var(--ui-surface)",
                border: "1px solid var(--ui-border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#14b8a6";
                (e.currentTarget as HTMLElement).style.borderColor = "#14b8a6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--ui-muted)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--ui-border)";
              }}
              aria-label="Notifications"
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 cursor-pointer"
              style={{
                background: "linear-gradient(135deg,#6EE7D8,#14B8A6)",
                color: "#0d2420",
              }}
              title={displayName}
            >
              {avatarLetter}
            </div>
          </div>
        </header>

        <main
          className="flex-1 overflow-auto"
          style={{ background: "var(--ui-bg)" }}
        >
          {authReady && user ? children : null}
        </main>
      </div>
    </div>
  );
}
