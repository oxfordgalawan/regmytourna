import Link from "next/link";
import { NAV_BACK } from "@/lib/nav-transitions";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { isChallongeConfigured } from "@/lib/env/server";
import { ChallongeConnectionCard } from "@/components/settings/challonge-connection-card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Connected accounts" };

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ challonge?: string }>;
}) {
  await requireUser();
  const { challonge: challongeStatus } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: account } = await supabase
    .from("challonge_accounts")
    .select("challonge_user_id, username, connected_at, scopes")
    .eq("user_id", user!.id)
    .is("disconnected_at", null)
    .maybeSingle();

  return (
    <div className="space-y-10">
      <div>
        <Link
          transitionTypes={NAV_BACK}
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <PageHeader
          className="mt-6"
          eyebrow="Integrations"
          title="Connected accounts"
          description="Link outside services so your brackets and results stay in sync."
        />
      </div>
      <ChallongeConnectionCard
        account={account}
        configured={isChallongeConfigured()}
        status={challongeStatus}
      />
    </div>
  );
}
