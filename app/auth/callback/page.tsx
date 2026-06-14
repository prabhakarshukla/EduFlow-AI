"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleVerification() {
      const code = searchParams.get("code");
      const nextPath = searchParams.get("next") || "/dashboard";
      const errorParam = searchParams.get("error_details") || searchParams.get("error");

      if (errorParam) {
        if (mounted) router.replace(`/auth/login?authError=${encodeURIComponent(errorParam)}`);
        return;
      }

      if (!code) {
        // Fallback for hash-based tokens if PKCE is disabled
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          if (data.session) {
            router.replace(nextPath);
          } else {
            router.replace("/auth/login?authError=Confirmation link is missing or expired.");
          }
        }
        return;
      }

      // Exchange the PKCE code for a session
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!mounted) return;

      if (exchangeError) {
        router.replace(`/auth/login?authError=${encodeURIComponent(exchangeError.message)}`);
      } else {
        router.replace(nextPath);
        router.refresh(); // Refresh to ensure server components pick up the new session
      }
    }

    handleVerification();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <div className="text-center w-full max-w-md mx-auto p-8 rounded-2xl" style={{ background: "#2a282a", border: "1px solid rgba(110,231,216,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.40)" }}>
      <svg className="w-12 h-12 mx-auto mb-5 animate-spin" style={{ color: "#6EE7D8" }} fill="none" viewBox="0 0 24 24">
         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: "#e2fdf9" }}>Verifying your account</h2>
      <p className="text-sm" style={{ color: "#7ca8a3" }}>Please wait a moment while we securely confirm your email and log you in...</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#222022" }}>
      {/* Background aesthetics */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 -right-48 w-[520px] h-[520px] rounded-full blur-3xl" style={{ background: "#6EE7D8", opacity: 0.055 }} />
        <div className="absolute -bottom-48 -left-48 w-[440px] h-[440px] rounded-full blur-3xl" style={{ background: "#14B8A6", opacity: 0.055 }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(110,231,216,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: 0.5 }} />
      </div>

      <div className="relative z-10 w-full">
        <Suspense fallback={
          <div className="text-center">
            <h2 className="text-xl font-bold" style={{ color: "#e2fdf9" }}>Loading...</h2>
          </div>
        }>
          <CallbackContent />
        </Suspense>
      </div>
    </div>
  );
}
