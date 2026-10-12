/**
 * Bootstrap a platform super admin (app_metadata.role = super_admin).
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... SUPER_ADMIN_NAME=Heathcliff \
 *     npx tsx scripts/create-super-admin.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 * (load from .env.local via dotenv if present).
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

const email = process.env.SUPER_ADMIN_EMAIL ?? process.argv[2];
const password = process.env.SUPER_ADMIN_PASSWORD ?? process.argv[3];
const fullName = process.env.SUPER_ADMIN_NAME ?? process.argv[4] ?? "Super Admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
  console.error("Provide SUPER_ADMIN_EMAIL (env or first arg: email [password] [name])");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: "super_admin" },
      user_metadata: { ...existing.user_metadata, full_name: fullName },
    });
    if (error) {
      console.error("Update user failed:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Updated existing user to super_admin:", userId);
  } else if (!password) {
    console.error("User not found — provide SUPER_ADMIN_PASSWORD to create a new account.");
    process.exit(1);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "super_admin" },
      user_metadata: { full_name: fullName, account_type: "organizer" },
    });
    if (error) {
      console.error("Create user failed:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Created super_admin user:", userId);
  }

  await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    account_type: "organizer",
  });

  console.log("Done. Sign in at /login — you will be redirected to /super-admin");
}

main();
