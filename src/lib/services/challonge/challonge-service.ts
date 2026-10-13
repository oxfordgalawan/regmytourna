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
        "Authorization-Type": "v2",
        "Content-Type": "application/vnd.api+json",
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

  /** POST /tournaments — `attributes` built by `toChallongeTournament`. */
  async createTournament(attributes: Record<string, unknown>) {
    return challongeFetch<{ data: { id: string; attributes?: Record<string, unknown> } }>(
      "/tournaments.json",
      this.accessToken,
      { method: "POST", body: JSON.stringify({ data: { type: "tournaments", attributes } }) }
    );
  }

  /** Fetches every page of a list endpoint. */
  private async listAll<T>(path: string): Promise<T[]> {
    const perPage = 50;
    const all: T[] = [];
    for (let page = 1; page <= 40; page++) {
      const sep = path.includes("?") ? "&" : "?";
      const res = await challongeFetch<{ data: T[] }>(
        `${path}${sep}page=${page}&per_page=${perPage}`,
        this.accessToken
      );
      const items = res.data ?? [];
      all.push(...items);
      if (items.length < perPage) break;
    }
    return all;
  }

  async listParticipants(tournamentId: string) {
    return this.listAll<{ id: string; attributes?: Record<string, unknown> }>(
      `/tournaments/${tournamentId}/participants.json`
    );
  }

  async createParticipant(tournamentId: string, name: string, misc?: Record<string, unknown>) {
    return challongeFetch<{ data: { id: string } }>(
      `/tournaments/${tournamentId}/participants.json`,
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ data: { type: "Participants", attributes: { name, ...misc } } }),
      }
    );
  }

  /** POST /participants/bulk_add — adds everyone in one call, in the given (seed) order. */
  async bulkAddParticipants(tournamentId: string, names: string[]) {
    if (!names.length) return;
    return challongeFetch<{ data: unknown }>(
      `/tournaments/${tournamentId}/participants/bulk_add.json`,
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          data: { type: "Participants", attributes: { participants: names.map((name) => ({ name })) } },
        }),
      }
    );
  }

  async removeParticipant(tournamentId: string, participantId: string) {
    return challongeFetch<void>(
      `/tournaments/${tournamentId}/participants/${participantId}.json`,
      this.accessToken,
      { method: "DELETE" }
    );
  }

  /** Creates the Challonge bracket for one category and records it on the division. */
  async createBracketForDivision(
    divisionId: string,
    attributes: Record<string, unknown>
  ): Promise<{ id: string; url: string }> {
    const admin = createAdminClient();
    const created = await this.createTournament(attributes);
    const id = String(created.data.id);
    const attrs = created.data.attributes ?? {};
    const url =
      typeof attrs.full_challonge_url === "string"
        ? attrs.full_challonge_url
        : `https://challonge.com/${String(attrs.url ?? attributes.url)}`;
    await admin
      .from("tournament_divisions")
      .update({
        challonge_tournament_id: id,
        challonge_url: url,
        challonge_state: typeof attrs.state === "string" ? attrs.state : "pending",
        challonge_sync_status: "pending",
      })
      .eq("id", divisionId);
    return { id, url };
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
