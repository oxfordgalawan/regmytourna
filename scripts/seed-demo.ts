/**
 * Run with: npx tsx scripts/seed-demo.ts <organizer-user-uuid>
 * Creates demo tournaments for landing/directory (is_demo = true).
 */
import { createClient } from "@supabase/supabase-js";

const ownerId = process.argv[2];
if (!ownerId) {
  console.error("Usage: npx tsx scripts/seed-demo.ts <organizer-user-uuid>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function main() {
  const { data: t, error } = await supabase
    .from("tournaments")
    .insert({
      owner_id: ownerId,
      slug: "demo-manila-open-pickleball-2026",
      name: "Manila Open Pickleball 2026 (Demo)",
      description: "Sample tournament for RegMyTourna demo listings.",
      sport: "pickleball",
      status: "registration_open",
      is_public: true,
      is_demo: true,
      start_date: "2026-04-15",
      end_date: "2026-04-17",
      venue_name: "Ayala Malls Manila Bay Courts",
      city: "Pasay",
      region: "NCR",
      entry_fee_cents: 150000,
      currency: "PHP",
      rules: "USAPA rules apply. Demo data only.",
    })
    .select("id")
    .single();

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  await supabase.from("tournament_organizers").insert({
    tournament_id: t.id,
    user_id: ownerId,
    role: "owner",
  });

  console.log("Demo tournament created:", t.id);
}

main();
