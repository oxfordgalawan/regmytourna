import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuickScoreSessionByToken, sessionExpired } from "@/lib/quick-score/queries";
import { pickFreshOps, rowUpdateFromSnapshot } from "@/lib/quick-score/sync-apply";
import type { Op } from "@/lib/scoring/match-engine";

const MAX_OPS = 200;

function fail(error: string, code: string, status = 400) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getQuickScoreSessionByToken(token);
  if (!row) return fail("Session not found.", "not_found", 404);
  if (sessionExpired(row)) return fail("This scoring session has expired.", "expired", 410);

  let ops: Op[];
  try {
    const body = (await request.json()) as { ops?: Op[] };
    ops = Array.isArray(body.ops) ? body.ops.slice(0, MAX_OPS) : [];
  } catch {
    return fail("Bad request.", "bad_request");
  }

  const applied = Number(row.client_seq ?? 0);
  const picked = pickFreshOps(ops, applied);
  if (picked.fresh === null) {
    if ("bad" in picked && picked.bad) return fail("Bad op.", "bad_request");
    return fail("This match was changed from another device.", "stale", 409);
  }
  if (!picked.fresh.length) return NextResponse.json({ syncedSeq: applied });

  if (row.status === "completed") {
    return fail("This match is already finished.", "finished", 409);
  }

  const last = picked.last;
  if (!last) return NextResponse.json({ syncedSeq: applied });

  const update = rowUpdateFromSnapshot(last, { started_at: row.started_at, completed_at: row.completed_at }, picked.fresh[0].at);

  const admin = createAdminClient();
  const { error: writeError } = await admin.from("quick_score_sessions").update(update).eq("id", row.id);
  if (writeError) return fail(writeError.message, "db", 500);

  return NextResponse.json({ syncedSeq: last.seq });
}