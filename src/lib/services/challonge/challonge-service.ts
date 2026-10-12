import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/token-encryption";
import {
  CHALLONGE_API_V21,
  CHALLONGE_OAUTH_TOKEN,
  CHALLONGE_REQUEST_TIMEOUT_MS,
} from "./constants";

type ChallongeTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  created_at?: number;
};

async function challongeFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHALLONGE_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${CHALLONGE_API_V21}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Challonge API error ${res.status}: ${body.slice(0, 200)}`);
    }
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export class ChallongeService {
  constructor(
    private userId: string,
    private accessToken: string,
    private accountRowId: string
  ) {}

  static async forUser(userId: string): Promise<ChallongeService | null> {
    const admin = createAdminClient();
    const { data: account } = await admin
      .from("challonge_accounts")
      .select("*")
      .eq("user_id", userId)
      .is("disconnected_at", null)
      .maybeSingle();
    if (!account) return null;

    let accessToken = decryptToken(account.access_token_encrypted);
    if (
      account.token_expires_at &&
      new Date(account.token_expires_at).getTime() < Date.now() + 60_000
    ) {
      accessToken = await refreshAccessToken(userId, account.id, account.refresh_token_encrypted);
    }

    return new ChallongeService(userId, accessToken, account.id);
  }

  async getCurrentUser() {
    return challongeFetch<{ data: { id: string; type: string; attributes: Record<string, unknown> } }>(
      "/me.json",
      this.accessToken
    );
  }

  async listTournaments(params?: { includeCommunity?: boolean }) {
    const qs = params?.includeCommunity ? "?include_community_tournaments=1" : "";
    return challongeFetch<{ data: unknown[] }>(`/tournaments.json${qs}`, this.accessToken);
  }

  async getTournament(id: string) {
    return challongeFetch<{ data: unknown }>(`/tournaments/${id}.json`, this.accessToken);
  }

  async createTournament(body: Record<string, unknown>) {
    return challongeFetch<{ data: unknown }>("/tournaments.json", this.accessToken, {
      method: "POST",
      body: JSON.stringify({ tournament: body }),
    });
  }

  async listParticipants(tournamentId: string) {
    return challongeFetch<{ data: unknown[] }>(
      `/tournaments/${tournamentId}/participants.json`,
      this.accessToken
    );
  }

  async createParticipant(tournamentId: string, name: string, misc?: Record<string, unknown>) {
    return challongeFetch<{ data: unknown }>(
      `/tournaments/${tournamentId}/participants.json`,
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ participant: { name, ...misc } }),
      }
    );
  }

  async updateParticipant(tournamentId: string, participantId: string, body: Record<string, unknown>) {
    return challongeFetch<{ data: unknown }>(
      `/tournaments/${tournamentId}/participants/${participantId}.json`,
      this.accessToken,
      { method: "PUT", body: JSON.stringify({ participant: body }) }
    );
  }

  async removeParticipant(tournamentId: string, participantId: string) {
    return challongeFetch<void>(
      `/tournaments/${tournamentId}/participants/${participantId}.json`,
      this.accessToken,
      { method: "DELETE" }
    );
  }

  async listMatches(tournamentId: string) {
    return challongeFetch<{ data: unknown[] }>(
      `/tournaments/${tournamentId}/matches.json`,
      this.accessToken
    );
  }

  async getMatch(tournamentId: string, matchId: string) {
    return challongeFetch<{ data: unknown }>(
      `/tournaments/${tournamentId}/matches/${matchId}.json`,
      this.accessToken
    );
  }

  async reportScore(
    tournamentId: string,
    matchId: string,
    scoresCsv: string,
    isFinal = true
  ) {
    return challongeFetch<{ data: unknown }>(
      `/tournaments/${tournamentId}/matches/${matchId}.json`,
      this.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          match: {
            scores_csv: scoresCsv,
            ...(isFinal ? { winner_id: undefined } : {}),
          },
        }),
      }
    );
  }

  async syncParticipants(regmyTournamentId: string, challongeTournamentId: string) {
    const admin = createAdminClient();
    const job = await admin
      .from("integration_sync_jobs")
      .insert({
        tournament_id: regmyTournamentId,
        user_id: this.userId,
        job_type: "sync_participants",
        status: "running",
      })
      .select("id")
      .single();

    try {
      const { data: regs } = await admin
        .from("registrations")
        .select("id, challonge_participant_id, registration_players(guest_name, profiles(full_name))")
        .eq("tournament_id", regmyTournamentId)
        .eq("status", "confirmed");

      for (const reg of regs ?? []) {
        if (reg.challonge_participant_id) continue;
        const players = (reg.registration_players ?? []) as Array<{
          guest_name: string | null;
          profiles: { full_name: string } | { full_name: string }[] | null;
        }>;
        const name =
          players
            .map((p) => {
              const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              return prof?.full_name || p.guest_name;
            })
            .filter(Boolean)
            .join(" / ") || "Participant";
        const created = await this.createParticipant(challongeTournamentId, name);
        const participantId = (created as { data?: { id?: string } }).data?.id;
        if (participantId) {
          await admin
            .from("registrations")
            .update({
              challonge_participant_id: String(participantId),
              challonge_sync_status: "synced",
              challonge_last_synced_at: new Date().toISOString(),
            })
            .eq("id", reg.id);
        }
      }

      await admin
        .from("integration_sync_jobs")
        .update({ status: "completed", last_success_at: new Date().toISOString() })
        .eq("id", job.data!.id);
      await admin
        .from("tournaments")
        .update({
          challonge_sync_status: "synced",
          challonge_last_synced_at: new Date().toISOString(),
        })
        .eq("id", regmyTournamentId);
    } catch (err) {
      await admin
        .from("integration_sync_jobs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Sync failed",
        })
        .eq("id", job.data!.id);
      throw err;
    }
  }

  async syncMatches(regmyTournamentId: string, challongeTournamentId: string) {
    const admin = createAdminClient();
    const remote = await this.listMatches(challongeTournamentId);
    const items = (remote.data ?? []) as Array<{
      id: string;
      attributes?: Record<string, unknown>;
    }>;

    for (const item of items) {
      const attrs = item.attributes ?? {};
      const challongeMatchId = String(item.id);
      const { data: existing } = await admin
        .from("matches")
        .select("id")
        .eq("tournament_id", regmyTournamentId)
        .eq("challonge_match_id", challongeMatchId)
        .maybeSingle();

      const payload = {
        tournament_id: regmyTournamentId,
        challonge_match_id: challongeMatchId,
        team_a_label: String(attrs.player1_name ?? "TBD"),
        team_b_label: String(attrs.player2_name ?? "TBD"),
        status: attrs.state === "complete" ? "completed" : "scheduled",
        match_number: typeof attrs.identifier === "number" ? attrs.identifier : null,
      };

      if (existing) {
        await admin.from("matches").update(payload).eq("id", existing.id);
      } else {
        await admin.from("matches").insert(payload);
      }
    }
  }
}

async function refreshAccessToken(
  userId: string,
  accountId: string,
  refreshTokenEncrypted: string | null
): Promise<string> {
  if (!refreshTokenEncrypted) {
    throw new Error("Challonge refresh token missing; reconnect your account.");
  }
  const refreshToken = decryptToken(refreshTokenEncrypted);
  const clientId = process.env.CHALLONGE_CLIENT_ID!;
  const clientSecret = process.env.CHALLONGE_CLIENT_SECRET!;

  const res = await fetch(CHALLONGE_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to refresh Challonge token");
  }
  const json = (await res.json()) as ChallongeTokenResponse;
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await admin
    .from("challonge_accounts")
    .update({
      access_token_encrypted: encryptToken(json.access_token),
      refresh_token_encrypted: json.refresh_token
        ? encryptToken(json.refresh_token)
        : refreshTokenEncrypted,
      token_expires_at: expiresAt,
      scopes: json.scope ?? null,
    })
    .eq("id", accountId)
    .eq("user_id", userId);

  return json.access_token;
}

export async function exchangeChallongeCode(code: string): Promise<ChallongeTokenResponse> {
  const clientId = process.env.CHALLONGE_CLIENT_ID!;
  const clientSecret = process.env.CHALLONGE_CLIENT_SECRET!;
  const redirectUri = process.env.CHALLONGE_REDIRECT_URI!;

  const res = await fetch(CHALLONGE_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error("Challonge token exchange failed");
  }
  return (await res.json()) as ChallongeTokenResponse;
}

export async function fetchChallongeMe(accessToken: string) {
  const res = await fetch(`${CHALLONGE_API_V21}/me.json`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch Challonge user");
  return (await res.json()) as {
    data: { id: string; attributes: { username?: string; name?: string } };
  };
}
