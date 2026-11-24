import { notFound } from "next/navigation";
import { QuickScoreScorer } from "@/components/quick-score/quick-score-scorer";
import { getQuickScoreSessionByToken, sessionExpired } from "@/lib/quick-score/queries";
import { quickScoreTvUrl } from "@/lib/quick-score/urls";

export const metadata = { title: "Score match", robots: { index: false, follow: false } };

export default async function QuickScoreSessionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getQuickScoreSessionByToken(token);
  if (!row) notFound();

  if (sessionExpired(row)) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <p className="display text-3xl text-bone">Session expired</p>
          <p className="mt-2 text-sm text-muted-foreground">Start a new match from the umpire tool.</p>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="min-h-dvh bg-background">
      <QuickScoreScorer session={row} tvUrl={quickScoreTvUrl(token)} />
    </main>
  );
}