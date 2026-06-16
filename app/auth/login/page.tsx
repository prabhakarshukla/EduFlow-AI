"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { account } from "@/lib/appwrite";
import { ID, AppwriteException } from "appwrite";

function getAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("invalid credentials") || lower.includes("not found")) {
    return "Invalid email or password. Please check your details and try again.";
  }
  if (lower.includes("token") || lower.includes("expired") || lower.includes("invalid secret")) {
    return "The code is invalid or has expired. Please try again.";
  }

  return message;
}

function LoginPageContent() {
  const [step, setStep] = useState<"credentials" | "forgot_password" | "otp" | "otp_success">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw) return "/dashboard";
    const decoded = raw.startsWith("%2F") ? decodeURIComponent(raw) : raw;
    return decoded.startsWith("/") ? decoded : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    const authMessage = searchParams.get("authError") || searchParams.get("error_details") || searchParams.get("error");
    if (authMessage) setError(getAuthErrorMessage(authMessage));
    
    if (searchParams.get("registered") === "true") {
      setSuccess("Account created successfully. Please log in.");
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Check for session in localStorage to prevent 401 console error when not logged in
        const fallback = typeof window !== 'undefined' ? localStorage.getItem('cookieFallback') : null;
        if (!fallback || fallback === '[]') return;

        const session = await account.getSession("current");
        if (mounted && session) router.replace(nextPath);
      } catch (err) {
        // Not logged in
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, nextPath]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLoginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      // Clear any potential stale session first to prevent 'Creation of a session is prohibited' 401 errors
      try {
        await account.deleteSession("current");
      } catch (e) {
        // Ignore if no session exists
      }
      
      await account.createEmailPasswordSession(email.trim(), password);
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      if (err instanceof AppwriteException) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError(err instanceof Error ? err.message : "Could not log in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      setError("Please enter your registered email address.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const token = await account.createEmailToken(ID.unique(), email.trim());
      setUserId(token.userId);
      setStep("otp");
      setResendCooldown(60); // 60 seconds cooldown
      setSuccess("OTP sent successfully. It will expire in 10 minutes.");
    } catch (err) {
      if (err instanceof AppwriteException) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError(err instanceof Error ? err.message : "Could not send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await account.createSession(userId, otp.trim());
      setStep("otp_success");
      setSuccess("OTP verified successfully! You are securely logged in.");
    } catch (err) {
      if (err instanceof AppwriteException) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError(err instanceof Error ? err.message : "Verification failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await account.updatePassword(newPassword);
      await account.deleteSession("current");
      setSuccess("Password updated successfully. Please log in with your new password.");
      setTimeout(() => {
        setStep("credentials");
        setEmail("");
        setPassword("");
        setNewPassword("");
        setOtp("");
      }, 2000);
    } catch (err) {
      if (err instanceof AppwriteException) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError(err instanceof Error ? err.message : "Could not update password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWithoutReset = () => {
    router.replace(nextPath);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden" style={{ background: "#222022" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 -right-48 w-[520px] h-[520px] rounded-full blur-3xl" style={{ background: "#6EE7D8", opacity: 0.055 }} />
        <div className="absolute -bottom-48 -left-48 w-[440px] h-[440px] rounded-full blur-3xl" style={{ background: "#14B8A6", opacity: 0.055 }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(110,231,216,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: 0.5 }} />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-flex transition-all duration-200">
            <img src="/images/logo.png" alt="EduFlow AI" style={{ height: "72px", width: "auto", display: "block" }} />
          </Link>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: "#2a282a", border: "1px solid rgba(110,231,216,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.40), 0 32px 64px rgba(0,0,0,0.28)" }}>
          <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, #6EE7D8, #14B8A6, transparent)" }} />

          <div className="px-8 py-8">
            <div className="mb-7">
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5" style={{ color: "#e2fdf9" }}>
                {step === "credentials" ? "Welcome back" 
                 : step === "forgot_password" ? "Recover account"
                 : step === "otp" ? "Check your email" 
                 : "Recovery successful"}
              </h1>
              <p className="text-sm" style={{ color: "#7ca8a3" }}>
                {step === "credentials" ? "Log in to continue your learning journey." 
                 : step === "forgot_password" ? "Enter your email to receive a recovery OTP."
                 : step === "otp" ? `We sent a 6-digit code to ${email}` 
                 : "You are logged in. Set a new password or continue directly."}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm" role="alert" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", color: "#fca5a5" }}>
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm" role="alert" style={{ background: "rgba(110, 231, 216, 0.08)", border: "1px solid rgba(110, 231, 216, 0.22)", color: "#6EE7D8" }}>
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {success}
                </div>
              )}

              {step === "credentials" && (
                <form onSubmit={handleLoginWithPassword} className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Email address</label>
                    <input type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Password</label>
                      <button type="button" onClick={() => { setError(null); setSuccess(null); setStep("forgot_password"); }} disabled={loading} className="text-xs font-medium hover:underline transition-all" style={{ color: "#6EE7D8" }}>Forgot Password?</button>
                    </div>
                    <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />
                    <div className="flex items-center gap-2 pt-1">
                      <input id="login-show-password" type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="h-4 w-4 rounded border" style={{ accentColor: "#6EE7D8" }} />
                      <label htmlFor="login-show-password" className="text-xs font-medium select-none" style={{ color: "rgba(209,250,245,0.7)" }}>Show password</label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                      style={{ background: loading ? "rgba(110,231,216,0.35)" : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)", color: "#0d2420", boxShadow: loading ? "none" : "0 4px 16px rgba(110,231,216,0.30)" }}
                    >
                      {loading ? "Logging in..." : "Log in"}
                    </button>
                  </div>
                </form>
              )}

              {step === "forgot_password" && (
                <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Email address</label>
                    <input type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" autoComplete="email" />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{ background: loading ? "rgba(110,231,216,0.35)" : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)", color: "#0d2420", boxShadow: loading ? "none" : "0 4px 16px rgba(110,231,216,0.30)" }}
                  >
                    {loading ? "Sending..." : "Send OTP"}
                  </button>
                  <button type="button" onClick={() => setStep("credentials")} className="text-xs font-semibold mt-2 transition-colors duration-150" style={{ color: "rgba(110,231,216,0.60)" }}>
                    ← Back to login
                  </button>
                </form>
              )}

              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>6-Digit Verification Code</label>
                    <input type="text" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} required className="input text-center tracking-widest text-lg font-mono" autoComplete="one-time-code" maxLength={6} pattern="[0-9]*" inputMode="numeric" />
                  </div>
                  
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => handleSendOtp()} 
                      disabled={loading || resendCooldown > 0} 
                      className="text-xs font-medium hover:underline transition-all disabled:opacity-50 disabled:no-underline" 
                      style={{ color: "#6EE7D8" }}
                    >
                      {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{ background: loading ? "rgba(110,231,216,0.35)" : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)", color: "#0d2420", boxShadow: loading ? "none" : "0 4px 16px rgba(110,231,216,0.30)" }}
                  >
                    {loading ? "Please wait..." : "Verify OTP"}
                  </button>
                  <button type="button" onClick={() => setStep("credentials")} className="text-xs font-semibold mt-2 transition-colors duration-150" style={{ color: "rgba(110,231,216,0.60)" }}>
                    ← Back to login options
                  </button>
                </form>
              )}

              {step === "otp_success" && (
                <div className="flex flex-col gap-4">
                  <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Set a New Password (Optional)</label>
                      <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="input" autoComplete="new-password" minLength={8} />
                      <div className="flex items-center gap-2 pt-1">
                        <input id="login-show-password-reset" type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="h-4 w-4 rounded border" style={{ accentColor: "#6EE7D8" }} />
                        <label htmlFor="login-show-password-reset" className="text-xs font-medium select-none" style={{ color: "rgba(209,250,245,0.7)" }}>Show password</label>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                      style={{ background: loading ? "rgba(110,231,216,0.35)" : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)", color: "#0d2420", boxShadow: loading ? "none" : "0 4px 16px rgba(110,231,216,0.30)" }}
                    >
                      {loading ? "Updating..." : "Update Password & Continue"}
                    </button>
                  </form>
                  
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px" style={{ background: "rgba(110,231,216,0.09)" }} />
                    <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>or</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(110,231,216,0.09)" }} />
                  </div>
                  
                  <button
                    onClick={handleContinueWithoutReset}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#e2fdf9", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    Continue to Dashboard directly
                  </button>
                </div>
              )}

            </div>

            {step !== "otp_success" && (
              <>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px" style={{ background: "rgba(110,231,216,0.09)" }} />
                  <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>or</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(110,231,216,0.09)" }} />
                </div>

                <p className="text-center text-sm" style={{ color: "#7ca8a3" }}>
                  Don&apos;t have an account?{" "}
                  <Link href="/auth/signup" className="font-semibold transition-colors duration-150" style={{ color: "#6EE7D8" }}>Sign up free →</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#222022" }}>
        <div style={{ color: "#7ca8a3" }}>Loading…</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
