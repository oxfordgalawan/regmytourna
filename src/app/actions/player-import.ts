"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadImportContext } from "@/lib/import/server";
import { rowsFromCsv, rowsFromXlsx } from "@/lib/import/xlsx";
import {
  MAX_IMPORT_ROWS,
  gridFromText,
  rowsFromCategoryGrid,
  rowsFromGrid,
  validateImport,
  type ImportCategory,
  type ImportPreview,
  type RawRow,
} from "@/lib/import/players";
import { defaultConfigFor } from "@/lib/bracket-format";

type Mode = "add" | "replace";
const MAX_BYTES = 1024 * 1024;

async function readRows(formData: FormData, categories: ImportCategory[]): Promise<{ rows?: RawRow[]; error?: string }> {
  const file = formData.get("file");
  const text = String(formData.get("text") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "That file is over 1 MB. Split it or paste the rows instead." };
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) {
      try {
        return { rows: await rowsFromXlsx(await file.arrayBuffer()) };
      } catch (e) {
        console.error("[player-import] couldn't read upload", file.name, file.size, e);
        const why = e instanceof Error ? e.message.slice(0, 120) : "";
        return {
          error: `We couldn't read that Excel file${why ? ` (${why})` : ""}. Make sure it's closed in Excel, saved as .xlsx, and try again — or use Paste rows.`,
        };
      }
    }
    if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
      return { rows: rowsFromCsv(await file.text()) };
    }
    if (name.endsWith(".xls")) return { error: "Old .xls files aren't supported — save as .xlsx first." };
    return { error: "Upload an .xlsx or .csv file." };
  }
  if (text.trim()) {
    // pasted into one category: just Player 1 / Player 2 columns
    const cat = categories.find((c) => c.id === String(formData.get("divisionId") ?? ""));
    if (cat) return { rows: rowsFromCategoryGrid(gridFromText(text), cat.name, cat.name) };
    return { rows: rowsFromGrid(gridFromText(text)) };
  }
  return { error: "Choose a file or paste your rows." };
}

async function bracketOnlyContext(tournamentId: string) {
  await requireOrganizerForTournament(tournamentId);
  const ctx = await loadImportContext(tournamentId);
  if (!ctx.tournament) return { error: "Event not found." as const };
  if (ctx.tournament.registration_mode !== "bracket_only") {
    return { error: "Importing players is for bracket-only events." as const };
  }
  if (!ctx.categories.length) return { error: "Add your categories first, then import players." as const };
  return { ctx };
}

/** Step 1: read the file / pasted rows and show what will happen. Nothing is saved. */
export async function previewPlayerImportAction(
  tournamentId: string,
  formData: FormData
): Promise<{ preview?: ImportPreview; rows?: RawRow[]; error?: string }> {
  const c = await bracketOnlyContext(tournamentId);
  if ("error" in c) return { error: c.error };
  const read = await readRows(formData, c.ctx.categories);
  if (read.error || !read.rows) return { error: read.error };
  if (!read.rows.length) return { error: "We didn't find any players. Check that the sheet has rows under the header." };
  if (read.rows.length > MAX_IMPORT_ROWS) return { error: `That's over ${MAX_IMPORT_ROWS} rows — split it into smaller files.` };
  const mode = formData.get("mode") === "replace" ? "replace" : "add";
  return { preview: validateImport(read.rows, c.ctx.categories, c.ctx.existing, mode), rows: read.rows };
}

/**
 * Step 2: save. Re-checks everything on the server, then inserts every "ok" row.
 * "replace" first removes the current players in the categories in the file.
 */
export async function commitPlayerImportAction(
  tournamentId: string,
  rows: RawRow[],
  options: { mode: Mode; raiseCapacity: boolean }
): Promise<{ ok?: true; added?: number; error?: string }> {
  const c = await bracketOnlyContext(tournamentId);
  if ("error" in c) return { error: c.error };
  const user = await requireOrganizerForTournament(tournamentId);
  const preview = validateImport(rows.slice(0, MAX_IMPORT_ROWS), c.ctx.categories, c.ctx.existing, options.mode);
  const good = preview.rows.filter((r) => r.status === "ok" && r.divisionId);
  if (!good.length) return { error: "Nothing to import — fix the highlighted rows first." };

  const over = preview.categories.filter((s) => s.overCapacity);
  if (over.length && !options.raiseCapacity) {
    return { error: `${over[0].name} would have ${over[0].total} entries but its limit is ${over[0].capacity}.` };
  }

  const admin = createAdminClient();
  const touched = [...new Set(good.map((r) => r.divisionId!))];

  if (options.mode === "replace") {
    const open = touched.filter((id) => !c.ctx.categories.find((x) => x.id === id)?.drawStarted);
    if (open.length) {
      await admin
        .from("registrations")
        .update({ status: "cancelled", waitlist_position: null })
        .in("division_id", open)
        .in("status", ["confirmed", "awaiting_payment", "pending", "awaiting_partner", "waitlisted"]);
    }
  }

  for (const s of over) {
    await admin
      .from("tournament_divisions")
      .update({ capacity: s.total, bracket_config: defaultConfigFor(s.total) })
      .eq("id", s.divisionId);
  }

  // registrations in one go, then their players
  const { data: inserted, error } = await admin
    .from("registrations")
    .insert(
      good.map((r) => ({
        tournament_id: tournamentId,
        division_id: r.divisionId!,
        registered_by: user.id,
        status: "confirmed" as const,
        payment_status: "paid" as const,
        entry_source: "import",
        seed: r.seed,
      }))
    )
    .select("id");
  if (error || !inserted || inserted.length !== good.length) {
    return {
      error: error?.message.includes("entry_source")
        ? "Importing needs the latest database migration — run it and try again."
        : (error?.message ?? "Import failed."),
    };
  }

  const players = good.flatMap((r, i) => [
    { registration_id: inserted[i].id, guest_name: r.p1, is_primary: true },
    ...(r.p2 ? [{ registration_id: inserted[i].id, guest_name: r.p2, is_primary: false }] : []),
  ]);
  const { error: playersError } = await admin.from("registration_players").insert(players);
  if (playersError) {
    await admin.from("registrations").delete().in("id", inserted.map((x) => x.id));
    return { error: playersError.message };
  }

  revalidatePath(`/organizer/tournaments/${tournamentId}/registrations`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/draw`);
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  if (c.ctx.tournament?.slug) revalidatePath(`/tournaments/${c.ctx.tournament.slug}`);
  return { ok: true, added: good.length };
}

/** Add one entry by hand (late additions). */
export async function addImportedPlayerAction(
  tournamentId: string,
  input: { divisionId: string; p1: string; p2: string }
): Promise<{ ok?: true; error?: string }> {
  const c = await bracketOnlyContext(tournamentId);
  if ("error" in c) return { error: c.error };
  const cat = c.ctx.categories.find((x) => x.id === input.divisionId);
  if (!cat) return { error: "Pick a category." };
  const preview = validateImport(
    [{ row: 1, category: cat.name, p1: input.p1, p2: input.p2, seed: "" }],
    c.ctx.categories,
    c.ctx.existing,
    "add"
  );
  const row = preview.rows[0];
  if (row.status === "skip") return { error: "That entry is already in this category." };
  if (row.status === "error") return { error: row.errors[0] };
  const res = await commitPlayerImportAction(
    tournamentId,
    [{ row: 1, category: cat.name, p1: input.p1, p2: input.p2, seed: "" }],
    { mode: "add", raiseCapacity: true }
  );
  return res.error ? { error: res.error } : { ok: true };
}
