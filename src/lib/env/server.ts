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
  UMPIRE_SESSION_SECRET: z.string().min(16).optional(),
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

export function isResendConfigured(): boolean {
  return Boolean(getServerEnv().RESEND_API_KEY);
}

export function getAppUrl(): string {
  return getServerEnv().NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
