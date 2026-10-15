import Link from "next/link";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { dateTile, daysUntil, formatDateRange, formatPhp } from "@/lib/format";
import { PageHeader, SectionHeading, StatTile } from "@/components/layout/page-header";
import { ArrowUpRight, ChevronRight, Database, Plus, Trophy } from "lucide-react";
import { getViewRole } from "@/lib/auth/role";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";
import { loadPlayerEntries } from "@/lib/player/entries";
import { listPublicTournaments } from "@/lib/tournaments/queries";
import { PlayerHome } from "@/components/player/player-home";
import { PartnerInvitesCard } from "@/components/player/partner-invites-card";
import { pendingInvitesForEmail } from "@/lib/registrations/partner-invites";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await connection();
  const user = await requireUser();
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Database}
        title="Configure Supabase"
        description="Add Supabase environment variables to load your dashboard."
      />
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // players get their own home: entries, countdown, events to join — no organizer tools
  if ((await getViewRole(user.id, { superAdmin: isSuperAdmin(user) })).view === "player") {
    const [entries, open, invites] = await Promise.all([
      loadPlayerEntries(user.id),
      listPublicTournaments({ status: "registration_open", pageSize: 9 }).catch(() => ({ data: [] })),
      pendingInvitesForEmail(user.email).catch(() => []),
    ]);
    return (
      <PlayerHome
        firstName={(profile?.full_name || user.email || "Player").split(/[\s@]/)[0]}
        entries={entries}
        openTournaments={open.data}
        invites={invites}
      />
    );
  }

  // organizer overview: only their events — their own entries live in the player view
  const [{ data: orgTournaments }, { data: orgRegs }, { data: wallet }, { data: challonge }, invites] =
    await Promise.all([
      supabase
        .from("tournaments")
        .select("id, name, slug, status, start_date")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("registrations")
        .select("id, status, payment_status, tournaments!inner(owner_id)")
        .eq("tournaments.owner_id", user.id),
      supabase.from("organizer_wallets").select("available_balance_cents").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("challonge_accounts")
        .select("username, connected_at")
        .eq("user_id", user.id)
        .is("disconnected_at", null)
        .maybeSingle(),
      pendingInvitesForEmail(user.email).catch(() => []),
    ]);

  const activeRegs = (orgRegs ?? []).filter((r) => r.status !== "cancelled" && r.status !== "refunded");
  const paidCount = activeRegs.filter((r) => r.payment_status === "paid").length;
  const unpaidCount = activeRegs.length - paidCount;
  const walletBalanceCents = wallet?.available_balance_cents ?? 0;
  const firstName = (profile?.full_name || user.email || "").split(/[\s@]/)[0];

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Organizer"
        title={<>Hi, {firstName}</>}
        description={
          orgTournaments?.length
            ? "Here’s how your events are doing."
            : "Create your first event — categories, registration and payments in one place."
        }
        actions={
          <Button asChild>
            <Link href="/organizer/tournaments/new">
              <Plus />
              New tournament
            </Link>
          </Button>
        }
      />

      {/* someone added this organizer as their partner — accepting moves it to the player view */}
      <PartnerInvitesCard invites={invites} />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Events I run"
          value={orgTournaments?.length ?? 0}
          hint={orgTournaments?.length ? "Latest shown below" : "Create one any time"}
        />
        <StatTile label="Entries" value={activeRegs.length} hint={`${paidCount} paid · ${unpaidCount} to collect`} />
        <StatTile
          label="Wallet balance"
          value={formatPhp(walletBalanceCents)}
          hint={
            <Link
              href="/organizer/wallet"
              className="underline decoration-umber underline-offset-2 hover:decoration-brass"
            >
              View wallet & transactions
            </Link>
          }
        />
        <div className="flex flex-col justify-between bg-surface p-5">
          <p className="eyebrow">Challonge</p>
          {challonge ? (
            <div>
              <p className="mt-3 flex items-center gap-2 text-bone">
                <span className="size-2 rounded-full bg-bone" />
                Connected
              </p>
              <p className="mt-1 text-sm text-muted-foreground">as {challonge.username}</p>
            </div>
          ) : (
            <div>
              <p className="mt-3 text-sm text-muted-foreground">Optional — export brackets if you need to.</p>
              <Link
                href="/settings/connections"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-bone underline decoration-umber decoration-2 underline-offset-4 hover:decoration-brass"
              >
                Connect account
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <SectionHeading
          title="Events I run"
          action={
            orgTournaments?.length ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/organizer/tournaments">View all</Link>
              </Button>
            ) : undefined
          }
        />
        {!orgTournaments?.length ? (
          <EmptyState
            icon={Trophy}
            title="No events yet"
            description="Set up categories, fees and the registration period. Players can sign up as soon as you publish."
            action={
              <Button asChild>
                <Link href="/organizer/tournaments/new">
                  <Plus />
                  New tournament
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {orgTournaments.map((t) => {
              const tile = dateTile(t.start_date);
              return (
                <li key={t.id}>
                  <Link
                    href={`/organizer/tournaments/${t.id}`}
                    transitionTypes={NAV_FORWARD}
                    className="group flex items-center gap-4 bg-surface px-5 py-4 transition-colors hover:bg-espresso/60"
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-md border border-umber py-1 text-center">
                      <span className="font-mono text-[0.6rem] tracking-widest text-brass">{tile?.month ?? "TBA"}</span>
                      <span className="display text-2xl text-bone">{tile?.day ?? "––"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-bone">{t.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {daysUntil(t.start_date) ?? formatDateRange(t.start_date, null)}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
