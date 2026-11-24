import type { CourtPlayer } from "@/lib/scoring/officiating";
import type { QuickScorePlayerNames, QuickScoreSessionRow } from "@/lib/quick-score/types";

export function playersFromSession(row: Pick<QuickScoreSessionRow, "player_names" | "team_a_label" | "team_b_label">): {
  a: CourtPlayer[];
  b: CourtPlayer[];
} {
  const side = (names: string[], label: string): CourtPlayer[] => {
    const fromJson = names.map((name) => ({ name: name.trim(), avatarUrl: null })).filter((p) => p.name);
    if (fromJson.length) return fromJson;
    return label
      .split(/\s*\/\s*|\s+&\s+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, avatarUrl: null }));
  };
  return {
    a: side(row.player_names.a ?? [], row.team_a_label),
    b: side(row.player_names.b ?? [], row.team_b_label),
  };
}

export function teamLabelFromPlayers(names: string[], fallback: string) {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (!list.length) return fallback;
  if (list.length === 1) return list[0]!;
  return list.join(" / ");
}

export function buildPlayerNames(input: {
  doubles: boolean;
  a1: string;
  a2?: string;
  b1: string;
  b2?: string;
}): QuickScorePlayerNames {
  const a = input.doubles ? [input.a1, input.a2 ?? ""].filter((n) => n.trim()) : [input.a1].filter((n) => n.trim());
  const b = input.doubles ? [input.b1, input.b2 ?? ""].filter((n) => n.trim()) : [input.b1].filter((n) => n.trim());
  return { a, b };
}