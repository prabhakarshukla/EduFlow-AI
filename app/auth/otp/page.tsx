"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { captureEvent } from "../../../lib/posthog/helpers";
import { EVENTS } from "../../../lib/posthog/events";

function getAuthCallbackUrl(nextPath: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

function OtpPageContent() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw) return "/dashboard";
    const decoded = raw.startsWith("%2F") ? decodeURIComponent(raw) : raw;
    return decoded.startsWith("/") ? decoded : "/dashboard";
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAuthCallbackUrl(nextPath),
        },
      });

      if (signInError) {
        if (signInError.status === 429) {
          throw new Error("Too many requests. Please try again later.");
        }
        throw signInError;
      }

      setStep("verify");
      setSuccess("We've sent a magic link to your email. Click it to log in!");
      captureEvent(EVENTS.USER_SIGNED_UP, { method: "otp_requested" });
    } catch (err) {
      captureEvent(EVENTS.AUTH_ERROR, {
        error_type: err instanceof Error ? err.message : "unknown",
        page: "otp_request",
      });
      setError(
        err instanceof Error ? err.message : "Could not send OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (verifyError) {
        throw verifyError;
      }

      captureEvent(EVENTS.USER_LOGGED_IN, { method: "otp_verified" });
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      captureEvent(EVENTS.AUTH_ERROR, {
        error_type: err instanceof Error ? err.message : "unknown",
        page: "otp_verify",
      });
      setError(
        err instanceof Error ? err.message : "Invalid or expired code. Please try again.",
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
            className="inline-flex transition-all duration-200"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
              (e.currentTarget as HTMLElement).style.filter =
                "drop-shadow(0 0 16px rgba(110,231,216,0.45))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLElement).style.filter = "none";
            }}
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
                {step === "email" ? "Passwordless Login" : "Check your inbox"}
              </h1>
              <p className="text-sm" style={{ color: "#7ca8a3" }}>
                {step === "email"
                  ? "Enter your email to receive a secure login link."
                  : "Click the secure link we sent to your email to log in."}
              </p>
            </div>

            <form
              onSubmit={step === "email" ? handleSendOtp : handleVerifyOtp}
              className="flex flex-col gap-4"
            >
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

              {success && (
                <div
                  className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
                  role="status"
                  style={{
                    background: "rgba(110,231,216,0.08)",
                    border: "1px solid rgba(110,231,216,0.22)",
                    color: "#d1faf5",
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {success}
                </div>
              )}

              {step === "email" ? (
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
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{
                      background: "rgba(110,231,216,0.1)",
                      color: "#6EE7D8",
                    }}
                  >
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
                      />
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs font-semibold transition-colors duration-150"
                    style={{ color: "#6EE7D8" }}
                  >
                    ← Use a different email
                  </button>
                </div>
              )}

              {step === "email" && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
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
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 6px 22px rgba(110,231,216,0.46)";
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 4px 16px rgba(110,231,216,0.30)";
                    (e.currentTarget as HTMLElement).style.transform =
                      "translateY(0)";
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
                      Sending link...
                    </>
                  ) : (
                    "Send Magic Link"
                  )}
                </button>
              )}
            </form>
            
            {step === "email" && (
              <>
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
                  Prefer a password?{" "}
                  <Link
                    href="/auth/login"
                    className="font-semibold transition-colors duration-150"
                    style={{ color: "#6EE7D8" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#5EEAD4";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#6EE7D8";
                    }}
                  >
                    Log in with password →
                  </Link>
                </p>
              </>
            )}
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

export default function OtpPage() {
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
      <OtpPageContent />
    </Suspense>
  );
}
