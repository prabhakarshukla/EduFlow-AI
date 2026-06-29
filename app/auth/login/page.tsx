"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { captureEvent } from "../../../lib/posthog/helpers";
import { EVENTS } from "../../../lib/posthog/events";

function getAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address before logging in. Check your inbox for the Supabase confirmation link.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password. Please check your details and try again.";
  }

  if (lower.includes("expired")) {
    return "This sign-in or confirmation link has expired. Please request a new one.";
  }

  return message;
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw) return "/dashboard";
    const decoded = raw.startsWith("%2F") ? decodeURIComponent(raw) : raw;
    return decoded.startsWith("/") ? decoded : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    const authMessage =
      searchParams.get("authError") ||
      searchParams.get("error_details") ||
      searchParams.get("error");
    if (authMessage) setError(getAuthErrorMessage(authMessage));
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) router.replace(nextPath);
    })();
    return () => {
      mounted = false;
    };
  }, [router, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || "Login failed. Please try again.";
        captureEvent(EVENTS.AUTH_ERROR, {
          error_type: errorMessage,
          page: "login",
        });
        setError(getAuthErrorMessage(errorMessage));
        return;
      }

      captureEvent(EVENTS.USER_LOGGED_IN, { method: "email" });
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      captureEvent(EVENTS.AUTH_ERROR, {
        error_type: err instanceof Error ? err.message : "unknown",
        page: "login",
      });
      setError(
        err instanceof Error
          ? getAuthErrorMessage(err.message)
          : "Could not log in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{ background: "#222022" }}
    >
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-48 -right-48 w-[520px] h-[520px] rounded-full blur-3xl"
          style={{ background: "#6EE7D8", opacity: 0.055 }}
        />
        <div
          className="absolute -bottom-48 -left-48 w-[440px] h-[440px] rounded-full blur-3xl"
          style={{ background: "#14B8A6", opacity: 0.055 }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(110,231,216,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.5,
          }}
        />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="flex justify-center mb-8">
          <Link
            href="/"
            className="inline-flex transition-all duration-200 hover:scale-105 hover:drop-shadow-[0_0_16px_rgba(110,231,216,0.45)]"
          >
            <img
              src="/images/logo.png"
              alt="EduFlow AI"
              style={{ height: "72px", width: "auto", display: "block" }}
            />
          </Link>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#2a282a",
            border: "1px solid rgba(110,231,216,0.15)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.40), 0 32px 64px rgba(0,0,0,0.28)",
          }}
        >
          <div
            className="h-[2px] w-full"
            style={{
              background:
                "linear-gradient(90deg, #6EE7D8, #14B8A6, transparent)",
            }}
          />

          <div className="px-8 py-8">
            <div className="mb-7">
              <h1
                className="text-[22px] font-bold tracking-tight mb-1.5"
                style={{ color: "#e2fdf9" }}
              >
                Welcome back
              </h1>
              <p className="text-sm" style={{ color: "#7ca8a3" }}>
                Log in to continue your learning journey.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
                  role="alert"
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.22)",
                    color: "#fca5a5",
                  }}
                >
                  <svg
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  className="block text-xs font-semibold"
                  style={{ color: "rgba(209,250,245,0.75)" }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: "rgba(209,250,245,0.75)" }}
                  >
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium transition-colors duration-150 text-[rgba(110,231,216,0.60)] hover:text-[#6EE7D8]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input"
                  autoComplete="current-password"
                />
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="login-show-password"
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="h-4 w-4 rounded border"
                    style={{ accentColor: "#6EE7D8" }}
                  />
                  <label
                    htmlFor="login-show-password"
                    className="text-xs font-medium select-none"
                    style={{ color: "rgba(209,250,245,0.7)" }}
                  >
                    Show password
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 enabled:hover:shadow-[0_6px_22px_rgba(110,231,216,0.46)] enabled:hover:-translate-y-px"
                style={{
                  background: loading
                    ? "rgba(110,231,216,0.35)"
                    : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
                  color: "#0d2420",
                  boxShadow: loading
                    ? "none"
                    : "0 4px 16px rgba(110,231,216,0.30)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
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
                    Logging in…
                  </>
                ) : (
                  "Log in"
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div
                className="flex-1 h-px"
                style={{ background: "rgba(110,231,216,0.09)" }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                or
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "rgba(110,231,216,0.09)" }}
              />
            </div>

            <p className="text-center text-sm" style={{ color: "#7ca8a3" }}>
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="font-semibold transition-colors duration-150 text-[#6EE7D8] hover:text-[#5EEAD4]"
              >
                Sign up free →
              </Link>
            </p>

            <p className="text-center text-sm mt-3" style={{ color: "#7ca8a3" }}>
              Want a passwordless login?{" "}
              <Link
                href="/auth/otp"
                className="font-semibold transition-colors duration-150 text-[#6EE7D8] hover:text-[#5EEAD4]"
              >
                Continue with OTP →
              </Link>
            </p>
          </div>
        </div>

        <p
          className="text-center text-[11px] mt-5"
          style={{ color: "rgba(255,255,255,0.20)" }}
        >
          © {new Date().getFullYear()} EduFlow AI — All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#222022" }}
        >
          <div style={{ color: "#7ca8a3" }}>Loading…</div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
