"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitEntryPetitionAction } from "@/app/actions/petitions";
import { PetitionProofUpload, type UploadedProof } from "@/components/petitions/petition-proof-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PetitionSubmitDialog({
  open,
  onOpenChange,
  tournamentId,
  registrationId,
  entryName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  registrationId: string;
  entryName: string;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [proofs, setProofs] = useState<UploadedProof[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (reason.trim().length < 10) {
      toast.error("Please describe your request in at least 10 characters.");
      return;
    }
    if (proofs.length < 1) {
      toast.error("Attach at least one proof image.");
      return;
    }
    setSubmitting(true);
    const res = await submitEntryPetitionAction({
      registrationId,
      reason,
      imagePaths: proofs.map((p) => ({
        storagePath: p.storagePath,
        contentType: p.contentType,
        byteSize: p.byteSize,
        width: p.width,
        height: p.height,
      })),
    });
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Petition submitted. The organizer will review it soon.");
    setReason("");
    setProofs([]);
    onOpenChange(false);
    onSubmitted();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,36rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit entry petition</DialogTitle>
          <DialogDescription>
            Request a review for <strong className="text-bone">{entryName}</strong>. Explain why and
            attach up to three photos as proof.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="petition-reason">Reason</Label>
            <Textarea
              id="petition-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe what you need reviewed and any relevant context…"
              rows={4}
              disabled={submitting}
            />
          </div>

          <PetitionProofUpload
            tournamentId={tournamentId}
            registrationId={registrationId}
            value={proofs}
            onChange={setProofs}
            disabled={submitting}
          />

          <Button type="button" className="w-full" disabled={submitting} onClick={submit}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit petition"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
