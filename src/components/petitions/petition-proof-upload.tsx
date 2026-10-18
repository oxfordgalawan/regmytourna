"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, optimizePetitionProof } from "@/lib/images/optimize";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PETITION_PROOFS_BUCKET = "petition-proofs";
const MAX_FILES = 3;

export type UploadedProof = {
  storagePath: string;
  previewUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
};

type Props = {
  tournamentId: string;
  registrationId: string;
  value: UploadedProof[];
  onChange: (next: UploadedProof[]) => void;
  disabled?: boolean;
};

export function PetitionProofUpload({ tournamentId, registrationId, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null | undefined) {
    if (!fileList?.length || disabled || busy) return;
    const remaining = MAX_FILES - value.length;
    if (remaining <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} images.`);
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to upload proof.");

      const added: UploadedProof[] = [];
      for (const file of files) {
        const img = await optimizePetitionProof(file);
        const ext = img.type === "image/webp" ? "webp" : "jpg";
        const path = `${tournamentId}/${registrationId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(PETITION_PROOFS_BUCKET).upload(path, img.blob, {
          contentType: img.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw new Error(error.message);

        const previewUrl = URL.createObjectURL(img.blob);
        added.push({
          storagePath: path,
          previewUrl,
          contentType: img.type,
          byteSize: img.blob.size,
          width: img.width,
          height: img.height,
        });
      }
      onChange([...value, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    const next = [...value];
    const removed = next.splice(index, 1)[0];
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        disabled={disabled || busy || value.length >= MAX_FILES}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {value.map((item, i) => (
            <li key={item.storagePath} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="" className="size-full object-cover" />
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                className="absolute right-1 top-1 opacity-90"
                disabled={disabled || busy}
                onClick={() => removeAt(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <span className="absolute inset-x-0 bottom-0 bg-ink/70 px-1 py-0.5 font-mono text-[0.6rem] text-bone/90">
                {formatBytes(item.byteSize)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {value.length < MAX_FILES && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-umber bg-umber/5 px-4 py-6 text-center transition-colors hover:border-brass hover:bg-umber/15",
            (disabled || busy) && "pointer-events-none opacity-60"
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-umber text-bone">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </span>
          <span className="text-sm font-medium text-bone">
            {busy ? "Processing…" : "Add proof photos"}
          </span>
          <span className="text-xs text-muted-foreground">
            Up to {MAX_FILES} images, 5 MB each before we optimize them.
          </span>
        </button>
      )}
    </div>
  );
}
