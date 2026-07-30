import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseConfig } from "@/lib/supabase-config";

type LoginPayload = {
  email?: string;
  password?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function mapSupabaseLoginError(message: string): string {
  const lower = (message || "").toLowerCase();

  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (lower.includes("email not confirmed") || lower.includes("confirm your email")) {
    return "Please confirm your email address before logging in. Check your inbox for the link.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many login attempts. Please wait a minute and try again.";
  }
  return message || "Login failed. Please try again.";
}

export async function POST(request: NextRequest) {
  let body: LoginPayload;
  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Please refresh the page and try again." },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (
    !supabaseUrl ||
    supabaseUrl.includes("placeholder") ||
    !supabaseAnonKey ||
    supabaseAnonKey === "placeholder-key"
  ) {
    return NextResponse.json(
      { error: "Server is not configured for logins. Please contact the admin." },
      { status: 503 },
    );
  }

  const response = NextResponse.json(
    { ok: true, message: "Login successful." },
    { status: 200 },
  );
  const supabase = createSupabaseServerClient(
    request,
    response,
    supabaseUrl,
    supabaseAnonKey,
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: mapSupabaseLoginError(error.message) },
      { status: 400 },
    );
  }

  if (!data?.user || !data?.session) {
    return NextResponse.json(
      { error: "Could not complete sign-in. Please try again." },
      { status: 400 },
    );
  }

  return response;
}
