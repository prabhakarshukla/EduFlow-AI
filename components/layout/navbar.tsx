"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

const navLinks = [
  { label: "Home", href: "/#home" },
  { label: "Features", href: "/#features" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Settings", href: "/dashboard/settings" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMobileOpen(false);
    router.replace("/auth/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href.startsWith("/#")) {
      return pathname === "/" && href === "/#home";
    }
    return pathname === href;
  };

  const isDashboardOrAuth = pathname?.startsWith("/dashboard") || pathname?.startsWith("/auth");

  if (isDashboardOrAuth) {
    return null;
  }

  const isAboutPage = pathname === "/about";
    const isDarkNavbar = pathname === "/" ? scrolled : !isAboutPage;
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isDarkNavbar ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.85)",
        borderBottom: isDarkNavbar
          ? "1px solid rgba(51, 65, 85, 0.6)"
          : "1px solid rgba(229, 231, 235, 0.6)",
        boxShadow: isDarkNavbar
          ? "0 4px 20px -2px rgba(0, 0, 0, 0.35), 0 2px 8px -1px rgba(0, 0, 0, 0.2)"
          : "0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 8px -1px rgba(0, 0, 0, 0.03)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* <div className="flex items-center justify-between h-[60px] gap-6"> */}
        <div className="flex md:grid md:grid-cols-3 items-center justify-between h-[60px]">
          <Link
            href="/"
            className="flex items-center flex-shrink-0 transition-all duration-200 hover:scale-[1.04]"
          >
            <img
              src="/images/logo.png"
              alt="EduFlow AI"
              style={{
                height: "48px",
                width: "auto",
                display: "block",
                filter: isDarkNavbar
                  ? "drop-shadow(0 1px 2px rgba(255,255,255,0.1)) contrast(1.06)"
                  : "drop-shadow(0 1px 2px rgba(31,41,55,0.14)) contrast(1.06)",
              }}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center px-4">
            {navLinks.map(({ label, href }) => {
              const active = isActive(href);
              return (
                <Link
                  key={label}
                  href={href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${isDarkNavbar
                    ? active
                      ? "text-teal-400 bg-teal-400/10"
                      : "text-slate-300 hover:text-teal-400 hover:bg-teal-400/10"
                    : active
                      ? "text-teal-600 bg-teal-500/10"
                      : "text-slate-700 hover:text-teal-600 hover:bg-teal-500/10"
                    }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* <div className="hidden md:flex items-center gap-2.5 flex-shrink-0"> */}
          <div className="hidden px-9 py-2 md:flex items-center gap-3 flex-shrink-0">

            {authReady && user ? (
              <>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-150 whitespace-nowrap ${isDarkNavbar
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${isDarkNavbar
                    ? "text-slate-400 hover:text-teal-400 hover:bg-slate-800"
                    : "text-slate-500 hover:text-teal-600 hover:bg-slate-50"
                    }`}
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl whitespace-nowrap bg-gradient-to-r from-[#6EE7D8] to-[#14B8A6] text-[#0d2420] shadow-[0_3px_12px_rgba(110,231,216,0.28)] hover:shadow-[0_5px_18px_rgba(110,231,216,0.44)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  Get Started
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.2}
                      d="M5 12h14m-7-7l7 7-7 7"
                    />
                  </svg>
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg transition-colors duration-150"
            style={{
              color: isDarkNavbar ? "#6EE7D8" : "#14b8a6",
              background: isDarkNavbar ? "rgba(110,231,216,0.06)" : "rgba(20, 184, 166, 0.06)",
            }}
            aria-label="Toggle menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div
            className="md:hidden pb-5 pt-3"
            style={{
              borderTop: isDarkNavbar
                ? "1px solid rgba(51, 65, 85, 0.6)"
                : "1px solid rgba(229, 231, 235, 0.6)",
            }}
          >
            <nav className="flex flex-col gap-1 mb-4">
              {navLinks.map(({ label, href }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${isDarkNavbar
                      ? active
                        ? "text-teal-400 bg-teal-400/10"
                        : "text-slate-300 hover:text-teal-400 hover:bg-teal-400/10"
                      : active
                        ? "text-teal-600 bg-teal-500/10"
                        : "text-slate-700 hover:text-teal-600 hover:bg-teal-500/10"
                      }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-2">
              {authReady && user ? (
                <>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-4 py-2.5 text-center text-sm font-medium rounded-xl border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className={`px-4 py-2.5 text-center text-sm font-medium rounded-xl border transition-colors ${isDarkNavbar
                      ? "border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      : "border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2.5 text-center text-sm font-semibold rounded-xl bg-gradient-to-r from-[#6EE7D8] to-[#14B8A6] text-[#0d2420] shadow-[0_3px_12px_rgba(110,231,216,0.28)] hover:shadow-[0_5px_18px_rgba(110,231,216,0.44)] transition-all duration-200"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
