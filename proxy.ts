import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseConfig } from "@/lib/supabase-config";

function redirectTo(
  request: NextRequest,
  pathname: string,
  searchParams?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams))
      url.searchParams.set(k, v);
  }

  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const searchParams = request.nextUrl.searchParams;

  const isDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const publicAuthRoutes = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/update-password",
  ];
  const isPublicAuthRoute = publicAuthRoutes.includes(pathname);
  const hasRecoveryParams =
    searchParams.get("type") === "recovery" ||
    searchParams.has("code") ||
    searchParams.has("access_token") ||
    searchParams.has("refresh_token") ||
    search.includes("code=") ||
    search.includes("type=recovery") ||
    search.includes("access_token=") ||
    search.includes("refresh_token=");

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (pathname.startsWith("/auth/update-password")) {
    return response;
  }

  if (isPublicAuthRoute || hasRecoveryParams) {
    return response;
  }

  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return response;
  }

  const { supabaseUrl, supabaseAnonKey } = supabaseConfig;
  const supabase = createSupabaseServerClient(
  request,
  response,
  supabaseUrl,
  supabaseAnonKey
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isDashboardRoute && !user) {
    const next = `${pathname}${search ?? ""}`;
    return redirectTo(request, "/auth/login", { next });
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/update-password",
  ],
};
