import { Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CourtScoringWidget } from "@/components/scoring/court-scoring-widget";
import { EmptyState } from "@/components/ui/empty-state";
import type { Match } from "@/types/database";

export default async function CourtScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: court } = await supabase.from("courts").select("*").eq("id", id).maybeSingle();

  let match: Match | null = null;
  let divisionName: string | undefined;

  if (court) {
    const { data: m } = await supabase
      .from("matches")
      .select("*")
      .eq("court_id", court.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    match = m as Match | null;
  } else {
    const { data: m } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
    match = m as Match | null;
  }

  if (!match) {
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center bg-background p-6">
        <EmptyState
          icon={Timer}
          className="w-full max-w-md"
          title={court ? `${court.name} is free` : "No active match"}
          description="Assign a match to this court from the organizer dashboard, then refresh this page."
        />
      </main>
    );
  }

  if (match.division_id) {
    const { data: division } = await supabase
      .from("tournament_divisions")
      .select("name")
      .eq("id", match.division_id)
      .maybeSingle();
    divisionName = division?.name;
  }

  return (
    <main id="main" className="min-h-dvh bg-background">
      <CourtScoringWidget
        courtName={court?.name ?? "Court"}
        match={match}
        divisionName={divisionName}
      />
    </main>
  );
}
