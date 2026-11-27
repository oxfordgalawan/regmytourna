"use server";

import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import type { ExportCategory, ExportRegistrationRow } from "@/lib/export/registration-export-rows";
import { buildRegistrationsExport } from "@/lib/export/registrations-xlsx";
import { buildRegistrationsPdf } from "@/lib/export/registrations-pdf";

type ExportPayload = {
  slug: string;
  eventName?: string;
  categories: ExportCategory[];
  rows: ExportRegistrationRow[];
};

type Result = { ok?: true; error?: string; base64?: string; filename?: string };

function slugFile(base: string) {
  return base.replace(/[^a-z0-9-]/gi, "-").slice(0, 48) || "entries";
}

export async function exportRegistrationsXlsxAction(tournamentId: string, payload: ExportPayload): Promise<Result> {
  try {
    await requireOrganizerForTournament(tournamentId);
    if (!payload.categories.length) return { error: "No categories to export." };
    const buffer = await buildRegistrationsExport(payload.categories, payload.rows);
    const slug = slugFile(payload.slug);
    return {
      ok: true,
      base64: buffer.toString("base64"),
      filename: `${slug}-entries.xlsx`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed." };
  }
}

export async function exportRegistrationsPdfAction(tournamentId: string, payload: ExportPayload): Promise<Result> {
  try {
    await requireOrganizerForTournament(tournamentId);
    if (!payload.categories.length) return { error: "No categories to export." };
    const buffer = buildRegistrationsPdf(payload.categories, payload.rows, { eventName: payload.eventName });
    const slug = slugFile(payload.slug);
    return {
      ok: true,
      base64: buffer.toString("base64"),
      filename: `${slug}-entries.pdf`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed." };
  }
}