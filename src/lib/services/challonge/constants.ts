export const CHALLONGE_API_BASE = "https://api.challonge.com";
export const CHALLONGE_OAUTH_AUTHORIZE = `${CHALLONGE_API_BASE}/oauth/authorize`;
export const CHALLONGE_OAUTH_TOKEN = `${CHALLONGE_API_BASE}/oauth/token`;
export const CHALLONGE_API_V21 = `${CHALLONGE_API_BASE}/v2.1`;

/** Minimum scopes for organizer tournament sync */
export const CHALLONGE_ORGANIZER_SCOPES = [
  "me",
  "tournaments:read",
  "tournaments:write",
  "participants:read",
  "participants:write",
  "matches:read",
  "matches:write",
].join(" ");

export const CHALLONGE_REQUEST_TIMEOUT_MS = 15_000;
