import { resolvePending } from "@/lib/bracket-engine";
import { refreshDivisionState, revalidateDraw } from "@/lib/draw/progress";
import { loadDivisionContext, writePatches } from "@/lib/draw/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Marks an entry withdrawn and walks over pending matches when the bracket is running. */
export async function applyBracketWithdrawalForRegistration(
  registrationId: string,
  options?: { revalidate?: boolean }
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: reg } = await admin.from("registrations").select("division_id").eq("id", registrationId).maybeSingle();
  if (!reg?.division_id) return { error: "Entry not found" };

  const ctx = await loadDivisionContext(reg.division_id);
  if (!ctx) return { error: "Category not found" };

  await admin.from("registrations").update({ withdrawn_at: new Date().toISOString() }).eq("id", registrationId);

  if (ctx.division.bracket_state !== "not_started") {
    ctx.withdrawn.add(registrationId);
    const patches = resolvePending(ctx.matches, { names: ctx.names, withdrawn: ctx.withdrawn });
    await writePatches(patches);
    const byId = new Map(ctx.matches.map((m) => [m.id, m]));
    for (const p of patches) Object.assign(byId.get(p.id)!, p);
    await refreshDivisionState(ctx, [...byId.values()]);
  }

  if (options?.revalidate !== false) {
    await revalidateDraw(ctx.division.tournament_id, ctx.division.id);
  }
  return {};
}