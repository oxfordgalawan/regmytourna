"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env/server";
import { buildPlayerNames, teamLabelFromPlayers } from "@/lib/quick-score/players";
import { personNamePartSchema } from "@/lib/validations/person-name";

function token() {
  return randomBytes(24).toString("base64url");
}

export async function createQuickScoreSessionAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Scoring is not available right now." };
  }

  const title = String(formData.get("title") ?? "").trim() || null;
  const format = formData.get("format") === "singles" ? "singles" : "doubles";
  const doubles = format === "doubles";
  const bestOf = formData.get("bestOf") === "1" ? 1 : 2;
  const gamesToWin = bestOf === 1 ? 1 : 2;

  const a1 = personNamePartSchema.safeParse(formData.get("a1"));
  const b1 = personNamePartSchema.safeParse(formData.get("b1"));
  const a2 = doubles ? personNamePartSchema.safeParse(formData.get("a2") ?? "") : { success: true as const, data: "" };
  const b2 = doubles ? personNamePartSchema.safeParse(formData.get("b2") ?? "") : { success: true as const, data: "" };

  if (!a1.success || !b1.success) {
    return { error: "Enter a name for each side." };
  }
  if (doubles && (!a2.success || !b2.success || !a2.data.trim() || !b2.data.trim())) {
    return { error: "Enter both player names for each doubles side." };
  }

  const playerNames = buildPlayerNames({
    doubles,
    a1: a1.data,
    a2: doubles ? a2.data : undefined,
    b1: b1.data,
    b2: doubles ? b2.data : undefined,
  });

  const teamALabel = teamLabelFromPlayers(playerNames.a, "Team A");
  const teamBLabel = teamLabelFromPlayers(playerNames.b, "Team B");
  const publicToken = token();

  const admin = createAdminClient();
  const { error } = await admin.from("quick_score_sessions").insert({
    public_token: publicToken,
    title,
    team_a_label: teamALabel,
    team_b_label: teamBLabel,
    player_names: playerNames,
    doubles,
    games_to_win: gamesToWin,
    status: "in_progress",
  });

  if (error) return { error: error.message };
  redirect(`/umpire-tool/s/${publicToken}`);
}