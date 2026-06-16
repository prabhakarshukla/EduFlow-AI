"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { account, databases, appwriteConfig } from "@/lib/appwrite";
import { ID, AppwriteException } from "appwrite";

function getAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("already exists")) {
    return "An account already exists for this email. Please log in instead.";
  }
  if (lower.includes("password")) {
    return "Please use a stronger password. It should be at least 8 characters.";
  }

  return message;
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Check for session in localStorage to prevent 401 console error when not logged in
        const fallback = typeof window !== 'undefined' ? localStorage.getItem('cookieFallback') : null;
        if (!fallback || fallback === '[]') return;

        const session = await account.getSession("current");
        if (mounted && session) router.replace("/dashboard");
      } catch (err) {
        // No session exists
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Create user account
      const user = await account.create(ID.unique(), email.trim(), password, name.trim());
      
      try {
        // Clear any stale session first
        try { await account.deleteSession("current"); } catch(e) {}
        
        // Create an active session to write to the database
        await account.createEmailPasswordSession(email.trim(), password);
        
        // Store user data in Appwrite Database
        if (appwriteConfig.databaseId && appwriteConfig.usersCollectionId) {
          await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.usersCollectionId,
            user.$id,
            {
              email: user.email,
              full_name: user.name,
              // Add other necessary default fields for your users table here
            }
          );
        }
        
        // Delete the session so they are forced to log in as per requirements
        await account.deleteSession("current");
      } catch (dbError) {
        console.error("Database storage error:", dbError);
        // We still created the user, so we can proceed to login, 
        // but maybe logout just in case
        try { await account.deleteSession("current"); } catch(e) {}
      }

      router.push("/auth/login?registered=true");
    } catch (err) {
      if (err instanceof AppwriteException) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError(err instanceof Error ? err.message : "Could not create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{ background: "#222022" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 -right-48 w-[520px] h-[520px] rounded-full blur-3xl" style={{ background: "#6EE7D8", opacity: 0.055 }} />
        <div className="absolute -bottom-48 -left-48 w-[440px] h-[440px] rounded-full blur-3xl" style={{ background: "#14B8A6", opacity: 0.055 }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(110,231,216,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: 0.5 }} />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="flex justify-center mb-7">
          <Link href="/" className="inline-flex transition-all duration-200">
            <img src="/images/logo.png" alt="EduFlow AI" style={{ height: "64px", width: "auto", display: "block" }} />
          </Link>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: "#2a282a", border: "1px solid rgba(110,231,216,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.40), 0 32px 64px rgba(0,0,0,0.28)" }}>
          <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, #6EE7D8, #14B8A6, transparent)" }} />
          <div className="px-8 py-8">
            <div className="mb-6">
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5" style={{ color: "#e2fdf9" }}>
                Create your account
              </h1>
              <p className="text-sm" style={{ color: "#7ca8a3" }}>
                Start your AI-powered study journey — free forever.
              </p>
            </div>

            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm" role="alert" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", color: "#fca5a5" }}>
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Full name</label>
                <input type="text" placeholder="Priya Sharma" value={name} onChange={(e) => setName(e.target.value)} required className="input" autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Email address</label>
                <input type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold" style={{ color: "rgba(209,250,245,0.75)" }}>Password</label>
                <input type={showPassword ? "text" : "password"} placeholder="Create a strong password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" autoComplete="new-password" minLength={8} />
                <div className="flex items-center gap-2 pt-1">
                  <input id="signup-show-password" type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="h-4 w-4 rounded border" style={{ accentColor: "#6EE7D8" }} />
                  <label htmlFor="signup-show-password" className="text-xs font-medium select-none" style={{ color: "rgba(209,250,245,0.7)" }}>Show password</label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
                style={{
                  background: loading ? "rgba(110,231,216,0.35)" : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
                  color: "#0d2420",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(110,231,216,0.30)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Please wait..." : "Sign Up"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: "rgba(110,231,216,0.09)" }} />
              <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "rgba(110,231,216,0.09)" }} />
            </div>

            <p className="text-center text-sm" style={{ color: "#7ca8a3" }}>
              Already have an account?{" "}
              <Link href="/auth/login" className="font-semibold transition-colors duration-150" style={{ color: "#6EE7D8" }}>Log in →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
