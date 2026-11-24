import { notFound } from "next/navigation";
import { QuickScoreTv } from "@/components/quick-score/quick-score-tv";
import { getQuickScoreSessionByToken } from "@/lib/quick-score/queries";

export const metadata = { title: "Live TV score", robots: { index: false, follow: false } };

export default async function QuickScoreTvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getQuickScoreSessionByToken(token);
  if (!row) notFound();

  return <QuickScoreTv token={token} />;
}