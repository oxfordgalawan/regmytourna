import { listPetitionsForOrganizerAction } from "@/app/actions/petitions";
import { PetitionReviewPanel } from "@/components/organizer/petition-review-panel";
import { PageHeader } from "@/components/layout/page-header";

export default async function PetitionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await listPetitionsForOrganizerAction(id);
  const rows = "rows" in result && result.rows ? result.rows : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entry petitions"
        description="Review player requests about their category entry. Proof photos stay private until you open them here."
      />
      {"error" in result && result.error ? (
        <p className="text-sm text-[#e58a72]">{result.error}</p>
      ) : (
        <PetitionReviewPanel tournamentId={id} initialRows={rows} />
      )}
    </div>
  );
}
