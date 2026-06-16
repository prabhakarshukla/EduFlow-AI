"use client";

import type { FormEvent } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

function AuthNotice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  const isError = tone === "error";

  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
      role={isError ? "alert" : "status"}
      style={{
        background: isError
          ? "rgba(248,113,113,0.08)"
          : "rgba(110,231,216,0.08)",
        border: isError
          ? "1px solid rgba(248,113,113,0.22)"
          : "1px solid rgba(110,231,216,0.22)",
        color: isError ? "#fca5a5" : "#d1faf5",
      }}
    >
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isError ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        )}
      </svg>
      {message}
    </div>
  );
}

function UpdatePasswordContent() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const handledRecoveryUrl = useRef(false);

  useEffect(() => {
    let mounted = true;

    const handleRecovery = async () => {
      setCheckingSession(true);

      const { search, hash } = window.location;
      const queryParams = new URLSearchParams(search);
      const hashParams = new URLSearchParams(
        hash.startsWith("#") ? hash.slice(1) : hash,
      );
      const authMessage =
        queryParams.get("error_details") ||
        hashParams.get("error_details") ||
        queryParams.get("error") ||
        hashParams.get("error") ||
        queryParams.get("authError");

      if (authMessage && mounted) {
        setError(authMessage);
      }

      const code = queryParams.get("code");
      const accessToken =
        queryParams.get("access_token") || hashParams.get("access_token");
      const refreshToken =
        queryParams.get("refresh_token") || hashParams.get("refresh_token");
      const recoveryType = queryParams.get("type") || hashParams.get("type");
      const hasRecoveryParams = Boolean(
        code || accessToken || refreshToken || recoveryType,
      );
      const hasHash = hash.length > 0;
      let hadRecoveryError = false;

      if (!handledRecoveryUrl.current) {
        handledRecoveryUrl.current = true;

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError && mounted) {
            hadRecoveryError = true;
            setSessionReady(false);
            setError(
              exchangeError.message ||
                "This password reset link is invalid or expired. Please request a new one.",
            );
          }
        }

        if (hasHash) {
          const { data: hashedSession } = await supabase.auth.getSession();
          if (hashedSession.session && mounted) {
            setSessionReady(true);
            setError(null);
          }
        }

        if (accessToken && refreshToken && recoveryType === "recovery") {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError && mounted) {
            hadRecoveryError = true;
            setSessionReady(false);
            setError(
              sessionError.message ||
                "This password reset link is invalid or expired. Please request a new one.",
            );
          } else if (mounted) {
            setSessionReady(true);
            setError(null);
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) {
        setSessionReady(true);
        setError(null);
      }
      if (mounted && !data.session && !authMessage && !hadRecoveryError) {
        setSessionReady(false);
        setError(
          hasRecoveryParams
            ? "This password reset link is invalid or expired. Please request a new one."
            : "Open this page from the password reset link in your email, or request a new reset link if this one has expired.",
        );
      }
      if (mounted) setCheckingSession(false);
    };

    handleRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
        setError(null);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("Please choose a password with at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (!sessionReady) {
      setError(
        "Your password reset session is not ready yet. Open the latest reset link from your email and try again.",
      );
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Password updated. Taking you back to login...");
      setNewPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut();

      window.setTimeout(() => {
        router.replace("/auth/login");
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update your password. Please try again.",
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
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.filter =
                "drop-shadow(0 0 16px rgba(110,231,216,0.45))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.filter = "none";
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
                Choose a new password
              </h1>
              <p className="text-sm" style={{ color: "#7ca8a3" }}>
                Set a fresh password for your EduFlow AI account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <AuthNotice message={error} tone="error" />}
              {success && <AuthNotice message={success} tone="success" />}

              {checkingSession && (
                <AuthNotice
                  message="Checking your reset link..."
                  tone="success"
                />
              )}

              {sessionReady && (
                <>
                  <div className="space-y-1.5">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "rgba(209,250,245,0.75)" }}
                    >
                      New password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="input"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "rgba(209,250,245,0.75)" }}
                    >
                      Confirm password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="input"
                      autoComplete="new-password"
                    />
                    <p
                      className="text-[10px]"
                      style={{ color: "rgba(255,255,255,0.28)" }}
                    >
                      Use at least 6 characters.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="update-show-password"
                        type="checkbox"
                        checked={showPassword}
                        onChange={(e) => setShowPassword(e.target.checked)}
                        className="h-4 w-4 rounded border"
                        style={{ accentColor: "#6EE7D8" }}
                      />
                      <label
                        htmlFor="update-show-password"
                        className="text-xs font-medium select-none"
                        style={{ color: "rgba(209,250,245,0.7)" }}
                      >
                        Show password
                      </label>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading || checkingSession || !sessionReady}
                className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                style={{
                  background:
                    loading || checkingSession || !sessionReady
                      ? "rgba(110,231,216,0.35)"
                      : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
                  color: "#0d2420",
                  boxShadow:
                    loading || checkingSession || !sessionReady
                      ? "none"
                      : "0 4px 16px rgba(110,231,216,0.30)",
                  cursor:
                    loading || checkingSession || !sessionReady
                      ? "not-allowed"
                      : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!loading && !checkingSession && sessionReady) {
                    e.currentTarget.style.boxShadow =
                      "0 6px 22px rgba(110,231,216,0.46)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(110,231,216,0.30)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {loading || checkingSession ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
                    {checkingSession ? "Checking link..." : "Updating..."}
                  </>
                ) : (
                  "Update Password"
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
              Ready to sign in?{" "}
              <Link
                href="/auth/login"
                className="font-semibold transition-colors duration-150"
                style={{ color: "#6EE7D8" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#5EEAD4";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6EE7D8";
                }}
              >
                Back to Login
              </Link>
            </p>
          </div>
        </div>

        <p
          className="text-center text-[11px] mt-5"
          style={{ color: "rgba(255,255,255,0.20)" }}
        >
          (c) {new Date().getFullYear()} EduFlow AI - All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#222022" }}
        >
          <div style={{ color: "#7ca8a3" }}>Loading...</div>
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
