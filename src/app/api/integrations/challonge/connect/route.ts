import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, isChallongeConfigured, requireChallongeEnv } from "@/lib/env/server";
import {
  CHALLONGE_OAUTH_AUTHORIZE,
  CHALLONGE_ORGANIZER_SCOPES,
} from "@/lib/services/challonge/constants";

export async function GET() {
  if (!isChallongeConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/connections?challonge=not_configured", getAppUrl())
    );
  }
  requireChallongeEnv();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/settings/connections", getAppUrl()));
  }

  const state = randomBytes(32).toString("hex");
  const admin = createAdminClient();
  await admin.from("oauth_states").insert({
    state,
    user_id: user.id,
    provider: "challonge",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const params = new URLSearchParams({
    client_id: process.env.CHALLONGE_CLIENT_ID!,
    redirect_uri: process.env.CHALLONGE_REDIRECT_URI!,
    response_type: "code",
    scope: CHALLONGE_ORGANIZER_SCOPES,
    state,
  });

  return NextResponse.redirect(`${CHALLONGE_OAUTH_AUTHORIZE}?${params.toString()}`);
}
