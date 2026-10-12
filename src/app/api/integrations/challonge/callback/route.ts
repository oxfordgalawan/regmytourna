import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/crypto/token-encryption";
import {
  exchangeChallongeCode,
  fetchChallongeMe,
} from "@/lib/services/challonge/challonge-service";
import { getAppUrl, isChallongeConfigured } from "@/lib/env/server";

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings/connections", getAppUrl());
  if (!isChallongeConfigured()) {
    settingsUrl.searchParams.set("challonge", "not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    settingsUrl.searchParams.set("challonge", "denied");
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state) {
    settingsUrl.searchParams.set("challonge", "invalid");
    return NextResponse.redirect(settingsUrl);
  }

  const admin = createAdminClient();
  const { data: oauthState } = await admin
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    settingsUrl.searchParams.set("challonge", "expired_state");
    return NextResponse.redirect(settingsUrl);
  }

  await admin.from("oauth_states").delete().eq("state", state);

  try {
    const token = await exchangeChallongeCode(code);
    const me = await fetchChallongeMe(token.access_token);
    const challongeUserId = String(me.data.id);
    const username =
      me.data.attributes.username ?? me.data.attributes.name ?? challongeUserId;

    const { data: existingOther } = await admin
      .from("challonge_accounts")
      .select("user_id")
      .eq("challonge_user_id", challongeUserId)
      .is("disconnected_at", null)
      .maybeSingle();

    if (existingOther && existingOther.user_id !== oauthState.user_id) {
      settingsUrl.searchParams.set("challonge", "already_linked");
      return NextResponse.redirect(settingsUrl);
    }

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    await admin.from("challonge_accounts").upsert(
      {
        user_id: oauthState.user_id,
        challonge_user_id: challongeUserId,
        username,
        access_token_encrypted: encryptToken(token.access_token),
        refresh_token_encrypted: token.refresh_token
          ? encryptToken(token.refresh_token)
          : null,
        token_expires_at: expiresAt,
        scopes: token.scope ?? null,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
      },
      { onConflict: "user_id" }
    );

    await admin.from("audit_logs").insert({
      actor_id: oauthState.user_id,
      action: "challonge.connected",
      entity_type: "challonge_account",
      entity_id: challongeUserId,
      metadata: { username, scopes: token.scope },
    });

    settingsUrl.searchParams.set("challonge", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set("challonge", "error");
    return NextResponse.redirect(settingsUrl);
  }
}
