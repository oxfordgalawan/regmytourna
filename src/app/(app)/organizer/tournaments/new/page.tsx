import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TournamentForm } from "@/components/organizer/tournament-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Create tournament" };

export default function NewTournamentPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/organizer/tournaments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          My events
        </Link>
        <PageHeader
          className="mt-6"
          eyebrow="New event"
          title="Create a tournament"
          description="Standard pickleball divisions are added automatically — you can add more afterwards."
        />
      </div>
      <TournamentForm />
    </div>
  );
}
