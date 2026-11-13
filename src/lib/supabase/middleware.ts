import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPostLoginPath } from "@/lib/auth/get-post-login-path";
import { sanitizeNext } from "@/lib/auth/safe-next";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";

/** Supabase project ref of this app, e.g. "abcd1234" from https://abcd1234.supabase.co */
function projectRef() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

/**
 * Sign-in cookies from other Supabase projects (on a shared host like
 * localhost, every local app's cookies are sent here) only bloat the request
 * header until the server rejects it with 431. Expire them.
 */
function dropForeignAuthCookies(request: NextRequest, response: NextResponse) {
  const ref = projectRef();
  if (!ref) return response;
  for (const { name } of request.cookies.getAll()) {
    const m = name.match(/^sb-([a-z0-9]+)-auth-token/);
    if (m && m[1] !== ref) response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  return dropForeignAuthCookies(request, await handleSession(request));
}

async function handleSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/");

  const protectedPrefixes = [
    "/dashboard",
    "/explore",
    "/entries",
    "/settings",
    "/organizer",
    "/super-admin",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const isSuperAdminRoute = pathname.startsWith("/super-admin");

  if (isSuperAdminRoute && user && !isSuperAdmin(user)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.searchParams.set("error", "super_admin_required");
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    isAuthRoute &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/reset-password")
  ) {
    const redirectUrl = request.nextUrl.clone();
    const next = sanitizeNext(request.nextUrl.searchParams.get("next"));
    redirectUrl.pathname = getPostLoginPath(user, next);
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
