import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  CHALLONGE_CLIENT_ID: z.string().optional(),
  CHALLONGE_CLIENT_SECRET: z.string().optional(),
  CHALLONGE_REDIRECT_URI: z.string().url().optional(),
  CHALLONGE_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_PUBLIC_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).optional(),
  MIN_WITHDRAWAL_CENTS: z.coerce.number().int().min(0).optional(),
  RESEND_API_KEY: z.string().optional(),
  /** Resend "From" header, e.g. RegMyTourna <info@regmytourna.com> */
  RESEND_FROM: z.string().min(3).optional(),
  UMPIRE_SESSION_SECRET: z.string().min(16).optional(),
  STARPAGO_APP_ID: z.string().optional(),
  STARPAGO_APP_SECRET: z.string().optional(),
  STARPAGO_API_URL: z.string().url().optional(),
  STARPAGO_RELAY_URL: z.string().url().optional(),
  STARPAGO_RELAY_SECRET: z.string().optional(),
  STARPAGO_CALLBACK_IPS: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = serverEnvSchema.parse(process.env);
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isChallongeConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(
    env.CHALLONGE_CLIENT_ID &&
      env.CHALLONGE_CLIENT_SECRET &&
      env.CHALLONGE_REDIRECT_URI &&
      env.CHALLONGE_TOKEN_ENCRYPTION_KEY
  );
}

export function isPayMongoConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(
    env.PAYMONGO_SECRET_KEY &&
      env.PAYMONGO_PUBLIC_KEY &&
      env.PAYMONGO_WEBHOOK_SECRET
  );
}

export function isStarpagoConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.STARPAGO_APP_ID?.trim() && env.STARPAGO_APP_SECRET?.trim());
}

export function isResendConfigured(): boolean {
  return Boolean(getServerEnv().RESEND_API_KEY);
}

const DEFAULT_RESEND_FROM = "RegMyTourna <info@regmytourna.com>";

export function getResendFrom(): string {
  const raw = getServerEnv().RESEND_FROM?.trim();
  return raw || DEFAULT_RESEND_FROM;
}

function normalizeAppUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function appUrlFromHost(host: string): string {
  const cleaned = host.replace(/^https?:\/\//, "").split("/")[0]!.trim();
  return `https://${cleaned}`;
}

/** When NEXT_PUBLIC_APP_URL is missing, Vercel still knows the deployment host. */
function resolveVercelAppUrl(): string | null {
  if (process.env.VERCEL !== "1") return null;
  for (const raw of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    if (value.includes("://")) {
      try {
        const u = new URL(value);
        if (!isLoopbackHost(u.hostname)) return normalizeAppUrl(value);
      } catch {
        continue;
      }
    } else if (!isLoopbackHost(value)) {
      return normalizeAppUrl(appUrlFromHost(value));
    }
  }
  return null;
}

/** Public site origin for links in email, redirects, and copy-to-clipboard (server). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const u = new URL(configured);
      const onVercel = process.env.VERCEL === "1";
      if (!onVercel || !isLoopbackHost(u.hostname)) {
        return normalizeAppUrl(configured);
      }
    } catch {
      /* fall through */
    }
  }
  const vercel = resolveVercelAppUrl();
  if (vercel) return vercel;
  if (configured) return normalizeAppUrl(configured);
  return normalizeAppUrl(getServerEnv().NEXT_PUBLIC_APP_URL);
}

/** Prefer the host the organizer is actually on (fixes missing env on Vercel). */
export async function getRequestAppUrl(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host =
      h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host")?.trim();
    if (host && !isLoopbackHost(host.split(":")[0]!)) {
      const proto =
        h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (host.includes("localhost") ? "http" : "https");
      return normalizeAppUrl(`${proto}://${host}`);
    }
  } catch {
    /* outside a request */
  }
  return getAppUrl();
}

const DEFAULT_PLATFORM_FEE_PERCENT = 5;

export function getPlatformFeePercent(): number {
  const value = getServerEnv().PLATFORM_FEE_PERCENT;
  return value ?? DEFAULT_PLATFORM_FEE_PERCENT;
}

const DEFAULT_MIN_WITHDRAWAL_CENTS = 10000;

export function getMinWithdrawalCents(): number {
  const value = getServerEnv().MIN_WITHDRAWAL_CENTS;
  return value ?? DEFAULT_MIN_WITHDRAWAL_CENTS;
}

export function requireSupabaseEnv() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return getServerEnv() as ServerEnv & {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  };
}

export function requireChallongeEnv() {
  if (!isChallongeConfigured()) {
    throw new Error(
      "Challonge integration is not configured. Set CHALLONGE_CLIENT_ID, CHALLONGE_CLIENT_SECRET, CHALLONGE_REDIRECT_URI, and CHALLONGE_TOKEN_ENCRYPTION_KEY (32-byte base64)."
    );
  }
  return getServerEnv();
}
