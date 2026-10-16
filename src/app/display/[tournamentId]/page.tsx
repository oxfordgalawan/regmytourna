import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { loadQueue } from "@/lib/queue/load";
import { CourtsDisplay } from "@/components/display/courts-display";

export const metadata = { title: "TV display", robots: { index: false } };

/** Venue TV: one column per court with its live match and queue (see CourtsDisplay). */
export default async function DisplayPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tournamentId)) notFound();

  if (!isSupabaseConfigured()) {
    return <div className="min-h-screen bg-ink p-8 text-bone">Configure Supabase to load the TV display.</div>;
  }

  // visibility check through the public view (respects the event's privacy rules)
  const supabase = await createClient();
  const { data: visible } = await supabase
    .from("tournament_display_public")
    .select("tournament_name")
    .eq("tournament_id", tournamentId)
    .limit(1)
    .maybeSingle();
  if (!visible) {
    return (
      <div className="grain flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-bone">
        <p className="display text-6xl">Not on air yet</p>
        <p className="max-w-xl text-xl text-bone/60">
          This event isn&apos;t published. Publish it, or open the TV display while signed in as the organizer.
        </p>
        <AutoRefresh seconds={20} clock={false} />
      </div>
    );
  }

  return <CourtsDisplay name={visible.tournament_name ?? "Tournament"} data={await loadQueue(tournamentId)} />;
}
