import { NextResponse } from "next/server";
import { fuzzySearchTournaments } from "@/lib/tournaments/queries";

/** Search-as-you-type suggestions for the event search boxes. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  const results = q.trim().length >= 2 ? await fuzzySearchTournaments(q, 6) : [];
  return NextResponse.json({ results }, { headers: { "Cache-Control": "public, max-age=30" } });
}
