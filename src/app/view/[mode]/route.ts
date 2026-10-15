import { NextResponse, type NextRequest } from "next/server";
import { VIEW_COOKIE } from "@/lib/auth/role";
import { sanitizeNext } from "@/lib/auth/safe-next";

/**
 * /view/player     → show the player app
 * /view/organizer  → show the organizer app
 * Optional ?next=/path lands somewhere specific after switching.
 * Only changes what's shown; pages still check what the user may access.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const role = mode === "organizer" ? "organizer" : "player";
  const next = sanitizeNext(request.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(
    new URL(next ?? (role === "player" ? "/dashboard" : "/organizer/tournaments"), request.url)
  );
  res.cookies.set(VIEW_COOKIE, role, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
