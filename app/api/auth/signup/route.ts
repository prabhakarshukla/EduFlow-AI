import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseConfig } from "@/lib/supabase-config";

type SignupPayload = {
  email?: string;
  password?: string;
  fullName?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 100;

function mapSupabaseSignupError(message: string): string {
  const lower = (message || "").toLowerCase();

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account already exists for this email. Please log in instead.";
  }
  if (lower.includes("password")) {
    return "Please use a stronger password. It should be at least 8 characters.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many signup attempts. Please wait a minute and try again.";
  }
  if (lower.includes("email") && lower.includes("invalid")) {
    return "That email address looks invalid. Please check and try again.";
  }
  return message || "Signup failed. Please try again later.";
}

export async function POST(request: NextRequest) {
  let body: SignupPayload;
  try {
    body = (await request.json()) as SignupPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Please refresh the page and try again." },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const fullName = body.fullName?.trim() ?? "";

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
  if (password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }
  if (fullName.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` },
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
      { error: "Server is not configured for sign-ups. Please contact the admin." },
      { status: 503 },
    );
  }

  const response = NextResponse.json(
    { ok: true, message: "Account created. Check your inbox to confirm your email." },
    { status: 200 },
  );
  const supabase = createSupabaseServerClient(
    request,
    response,
    supabaseUrl,
    supabaseAnonKey,
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: mapSupabaseSignupError(error.message) },
      { status: 400 },
    );
  }

  if (data?.user && data.session == null) {
    return NextResponse.json(
      {
        ok: true,
        requiresEmailConfirmation: true,
        message:
          "Account created. Please check your inbox to confirm your email before logging in.",
      },
      { status: 200 },
    );
  }

  return response;
}
