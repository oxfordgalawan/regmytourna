/**
 * Upsert flattened PSGC rows into public.ph_places. Requires .env.local service role.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { FlatPlaceRow } from "./build-ph-places";

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 400;

async function main() {
  const placesPath = resolve(process.cwd(), "data/psgc/places.json");
  if (!existsSync(placesPath)) {
    console.error("Missing data/psgc/places.json — run: npx tsx scripts/build-ph-places.ts");
    process.exit(1);
  }

  const places = JSON.parse(readFileSync(placesPath, "utf8")) as FlatPlaceRow[];
  console.log(`Seeding ${places.length} places…`);

  for (let i = 0; i < places.length; i += BATCH) {
    const chunk = places.slice(i, i + BATCH);
    const { error } = await admin.from("ph_places").upsert(chunk, { onConflict: "psgc_code" });
    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + BATCH, places.length)} / ${places.length}`);
  }

  console.log("Done.");
}

main();
