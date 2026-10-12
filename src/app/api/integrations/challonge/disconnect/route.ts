import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("challonge_accounts")
    .select("id, challonge_user_id")
    .eq("user_id", user.id)
    .is("disconnected_at", null)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  await admin
    .from("challonge_accounts")
    .update({ disconnected_at: new Date().toISOString() })
    .eq("id", account.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "challonge.disconnected",
    entity_type: "challonge_account",
    entity_id: account.challonge_user_id,
  });

  return NextResponse.json({ success: true });
}
