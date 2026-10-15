import Link from "next/link";
import { Compass, History, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { loadPlayerEntries, isUpcoming } from "@/lib/player/entries";
import { PageHeader } from "@/components/layout/page-header";
import { EntryTicket } from "@/components/player/entry-ticket";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { PartnerInvitesCard } from "@/components/player/partner-invites-card";
import { pendingInvitesForEmail } from "@/lib/registrations/partner-invites";

export const metadata = { title: "My entries" };

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser("/entries");
  const { view } = await searchParams;
  const tab = view === "past" ? "past" : "upcoming";

  const [entries, invites] = await Promise.all([
    loadPlayerEntries(user.id),
    pendingInvitesForEmail(user.email).catch(() => []),
  ]);
  const upcoming = entries.filter(isUpcoming);
  const past = entries.filter((e) => !isUpcoming(e)).reverse();
  const list = tab === "past" ? past : upcoming;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your tournaments"
        title="My entries"
        description="Every event you've entered — payment, partner, and your next match."
      />

      <PartnerInvitesCard invites={invites} />

      <FilterChips
        label="Show"
        chips={[
          { key: "upcoming", label: `Upcoming · ${upcoming.length}`, active: tab === "upcoming", href: "/entries" },
          { key: "past", label: `Past · ${past.length}`, active: tab === "past", href: "/entries?view=past" },
        ]}
      />

      {list.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((e, i) => (
            <Reveal key={e.id} delay={Math.min(i, 6) * 60}>
              <EntryTicket entry={e} />
            </Reveal>
          ))}
        </div>
      ) : tab === "upcoming" ? (
        <EmptyState
          icon={Ticket}
          title="No upcoming entries"
          description="When you register for a tournament, your ticket shows up here with payment status and your next match."
          action={
            <Button asChild>
              <Link href="/explore">
                <Compass />
                Find a tournament
              </Link>
            </Button>
          }
        />
      ) : (
        <EmptyState icon={History} title="No past events yet" description="Finished tournaments and your results will appear here." />
      )}
    </div>
  );
}
