import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPhPlaces } from "@/lib/places/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limitRaw = Number(searchParams.get("limit") ?? 15);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 25) : 15;

  const supabase = await createClient();
  const results = await searchPhPlaces(supabase, q, limit);

  return NextResponse.json({ results });
}
