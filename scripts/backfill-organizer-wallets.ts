/**
 * Credit organizer wallets for paid payments that were not yet credited.
 * Loads .env.local; uses service role.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { creditOrganizerFromRegistration } = await import(
    "../src/lib/wallet/credit-organizer-from-payment"
  );

  const { data: payments, error } = await admin
    .from("payments")
    .select("registration_id")
    .eq("status", "paid")
    .is("credited_to_user_id", null);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let credited = 0;
  for (const p of payments ?? []) {
    const result = await creditOrganizerFromRegistration(admin, p.registration_id);
    if (result.credited) credited += 1;
  }

  console.log(`Processed ${payments?.length ?? 0} paid payments; credited ${credited} new wallet entries.`);
}

main();
