"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, optimizeImage } from "@/lib/images/optimize";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const COVER_BUCKET = "tournament-covers";

type Status = "idle" | "optimizing" | "uploading";

/**
 * Cover image picker: optimizes in the browser, uploads to Supabase Storage
 * (`tournament-covers/<user id>/<uuid>.webp`), and submits the public URL as `name`.
 */
export function CoverImageUpload({ name = "coverImageUrl" }: { name?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [savings, setSavings] = useState<string | null>(null);
  const busy = status !== "idle";

  async function handle(file: File | undefined) {
    if (!file || busy) return;
    try {
      setStatus("optimizing");
      const img = await optimizeImage(file);

      setStatus("uploading");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again to upload.");

      const ext = img.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, img.blob, {
        contentType: img.type,
        cacheControl: "31536000", // file names are unique, so cache forever
        upsert: false,
      });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
      setUrl(data.publicUrl);
      setSavings(`${formatBytes(img.originalBytes)} → ${formatBytes(img.blob.size)} · ${img.width}×${img.height}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => handle(e.target.files?.[0])}
      />

      {url ? (
        <div className="group relative overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Cover preview" className="aspect-video w-full object-cover animate-in fade-in-0" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-ink/90 to-transparent p-3 pt-10">
            <span className="font-mono text-[0.7rem] text-bone/80">{savings}</span>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => {
                  setUrl(null);
                  setSavings(null);
                }}
                disabled={busy}
              >
                <Trash2 />
                Remove
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handle(e.dataTransfer.files?.[0]);
          }}
          disabled={busy}
          className={cn(
            "flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center transition-colors sm:aspect-[21/7]",
            dragging ? "border-brass bg-umber/30" : "border-umber bg-umber/5 hover:border-brass hover:bg-umber/15"
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-umber text-bone">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          </span>
          <span className="text-sm font-medium text-bone">
            {status === "optimizing"
              ? "Optimizing image…"
              : status === "uploading"
                ? "Uploading…"
                : "Add a cover photo"}
          </span>
          <span className="text-xs text-muted-foreground">
            Tap to choose or drop an image. We crop to 16:9 and shrink it for fast loading.
          </span>
        </button>
      )}
    </div>
  );
}
