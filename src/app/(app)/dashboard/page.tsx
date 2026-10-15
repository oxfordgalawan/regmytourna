import Link from "next/link";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { dateTile, daysUntil, formatDateRange, formatDateTime, formatPhp } from "@/lib/format";
import { PageHeader, SectionHeading, StatTile } from "@/components/layout/page-header";
import { ArrowUpRight, ChevronRight, Compass, Database, Plus, Receipt, Ticket } from "lucide-react";
import { relationOne } from "@/lib/supabase/relations";
import { getViewRole } from "@/lib/auth/role";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";
import { loadPlayerEntries } from "@/lib/player/entries";
import { listPublicTournaments } from "@/lib/tournaments/queries";
import { PlayerHome } from "@/components/player/player-home";

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
    const [entries, open] = await Promise.all([
      loadPlayerEntries(user.id),
      listPublicTournaments({ status: "registration_open", pageSize: 9 }).catch(() => ({ data: [] })),
    ]);
    return (
      <PlayerHome
        firstName={(profile?.full_name || user.email || "Player").split(/[\s@]/)[0]}
        entries={entries}
        openTournaments={open.data}
      />
    );
  }

  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, status, payment_status, tournaments(name, slug, start_date)")
    .eq("registered_by", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: payments } = await supabase
    .from("payments")
    .select("id, status, amount_cents, currency, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: orgTournaments } = await supabase
    .from("tournaments")
    .select("id, name, slug, status, start_date")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: orgRegs } = await supabase
    .from("registrations")
    .select("id, payment_status, tournaments!inner(owner_id)")
    .eq("tournaments.owner_id", user.id);

  const paidCount = (orgRegs ?? []).filter((r) => r.payment_status === "paid").length;
  const unpaidCount = (orgRegs ?? []).filter((r) => r.payment_status === "pending").length;

  const { data: wallet } = await supabase
    .from("organizer_wallets")
    .select("available_balance_cents")
    .eq("user_id", user.id)
    .maybeSingle();
  const walletBalanceCents = wallet?.available_balance_cents ?? 0;

  const { data: challonge } = await supabase
    .from("challonge_accounts")
    .select("username, connected_at")
    .eq("user_id", user.id)
    .is("disconnected_at", null)
    .maybeSingle();

  const firstName = (profile?.full_name || user.email || "").split(/[\s@]/)[0];
  const isOrganizer = Boolean(orgTournaments?.length);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Dashboard"
        title={<>Hi, {firstName}</>}
        description={
          registrations?.length
            ? "Here’s where your entries and events stand."
            : "Nothing on your calendar yet — let’s fix that."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/tournaments">
                <Compass />
                Find a tournament
              </Link>
            </Button>
            <Button asChild>
              <Link href="/organizer/tournaments/new">
                <Plus />
                New tournament
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="My entries"
          value={registrations?.length ?? 0}
          hint={registrations?.length ? "Latest shown below" : "No entries yet"}
        />
        <StatTile
          label="Events I run"
          value={orgTournaments?.length ?? 0}
          hint={isOrganizer ? `${paidCount} paid · ${unpaidCount} unpaid entries` : "Create one any time"}
        />
        <StatTile
          label="Wallet balance"
          value={formatPhp(walletBalanceCents)}
          hint={
            isOrganizer ? (
              <Link
                href="/organizer/wallet"
                className="underline decoration-umber underline-offset-2 hover:decoration-brass"
              >
                View wallet & transactions
              </Link>
            ) : (
              "From paid entries on your events"
            )
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
              <p className="mt-3 text-sm text-muted-foreground">Sync brackets automatically.</p>
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
          title="My entries"
          action={
            registrations?.length ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tournaments">Find more</Link>
              </Button>
            ) : undefined
          }
        />
        {!registrations?.length ? (
          <EmptyState
            icon={Ticket}
            title="You haven’t entered any tournaments"
            description="Browse open events, pick a category and pay online. It takes about two minutes."
            action={
              <Button asChild>
                <Link href="/tournaments">Browse tournaments</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {registrations.map((r) => {
              const t = relationOne(r.tournaments) as {
                name: string;
                slug: string;
                start_date: string | null;
              } | null;
              if (!t) return null;
              const tile = dateTile(t.start_date);
              return (
                <li key={r.id}>
                  <Link
                    href={`/tournaments/${t.slug}`}
                    transitionTypes={NAV_FORWARD}
                    className="group flex items-center gap-4 bg-surface px-5 py-4 transition-colors hover:bg-espresso/60"
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-md border border-umber py-1 text-center">
                      <span className="font-mono text-[0.6rem] tracking-widest text-brass">
                        {tile?.month ?? "TBA"}
                      </span>
                      <span className="display text-2xl text-bone">{tile?.day ?? "––"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-bone">{t.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {daysUntil(t.start_date) ?? formatDateRange(t.start_date, null)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
                        <StatusBadge status={r.status} />
                        <StatusBadge status={r.payment_status} />
                      </div>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                      <StatusBadge status={r.status} />
                      <StatusBadge status={r.payment_status} />
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOrganizer && (
        <section className="space-y-4">
          <SectionHeading
            title="Events I run"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/organizer/tournaments">View all</Link>
              </Button>
            }
          />
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {orgTournaments!.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/organizer/tournaments/${t.id}`}
                  transitionTypes={NAV_FORWARD}
                  className="group flex items-center gap-4 bg-surface px-5 py-4 transition-colors hover:bg-espresso/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-bone">{t.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(t.start_date, null)}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <SectionHeading title="Recent payments" />
        {!payments?.length ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted-foreground">
            No payments yet. They’ll show up here once you pay for an entry.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 bg-surface px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Receipt className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-mono text-bone">{formatPhp(p.amount_cents, p.currency)}</span>
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    {formatDateTime(p.created_at)}
                  </span>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
