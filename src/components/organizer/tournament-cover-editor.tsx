"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/ui/app-toast";
import { updateTournamentCoverAction } from "@/app/actions/tournaments";
import { CoverImageUpload } from "@/components/images/cover-image-upload";

export function TournamentCoverEditor({
  tournamentId,
  defaultUrl,
}: {
  tournamentId: string;
  defaultUrl: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onChange(url: string | null) {
    setSaving(true);
    const res = await updateTournamentCoverAction(tournamentId, url);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(url ? "Cover photo saved" : "Cover photo removed");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-bone">Event cover</h2>
          <p className="text-sm text-muted-foreground">Shown on the public event page and listings.</p>
        </div>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>
      <CoverImageUpload defaultUrl={defaultUrl} hideFormField onChange={onChange} />
    </section>
  );
}