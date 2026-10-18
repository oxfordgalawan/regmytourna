"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updateProfileAvatarAction } from "@/app/actions/profile";
import { AvatarCropDialog } from "@/components/images/avatar-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { MAX_AVATAR_SOURCE_BYTES } from "@/lib/images/optimize";
import { notifyProfileUpdated } from "@/lib/profile/events";
import { profileInitials } from "@/lib/profile/initials";
import { cn } from "@/lib/utils";
import type { OptimizedImage } from "@/lib/images/optimize";

export const AVATAR_BUCKET = "profile-avatars";

type AvatarUploadProps = {
  userId: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  /** Large tile on settings header vs compact trigger styling */
  variant?: "header" | "inline";
  className?: string;
};

export function AvatarUpload({
  userId,
  displayName,
  email,
  avatarUrl: initialUrl,
  variant = "header",
  className,
}: AvatarUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialUrl ?? null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [sourceBytes, setSourceBytes] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setAvatarUrl(initialUrl ?? null);
  }, [initialUrl]);

  const initials = profileInitials(displayName, email) || "U";
  const isHeader = variant === "header";

  function pickFile() {
    inputRef.current?.click();
  }

  function onFileChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      toast.error("That image is too large. Please pick one under 8 MB.");
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setSourceBytes(file.size);
    setCropSrc(URL.createObjectURL(file));
    setCropOpen(true);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function uploadOptimized(img: OptimizedImage) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = img.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar.${ext}`;

      if (avatarUrl?.includes(`/profile-avatars/${userId}/`)) {
        try {
          const prevPath = avatarUrl.split(`/profile-avatars/`)[1]?.split("?")[0];
          if (prevPath && prevPath !== path) {
            await supabase.storage.from(AVATAR_BUCKET).remove([prevPath]);
          }
        } catch {
          // best-effort cleanup
        }
      }

      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, img.blob, {
        contentType: img.type,
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      const res = await updateProfileAvatarAction(publicUrl.split("?")[0] ?? publicUrl);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }

      setAvatarUrl(publicUrl);
      notifyProfileUpdated();
      toast.success("Profile photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (cropSrc) {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />

      <div className={cn("flex items-center gap-4", className)}>
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className={cn(
            "group relative shrink-0 rounded-full ring-2 ring-brass/60 ring-offset-2 ring-offset-ink transition hover:ring-brass focus-visible:outline-none focus-visible:ring-brass disabled:opacity-60",
            isHeader ? "size-16 sm:size-20" : "size-10"
          )}
          aria-label="Change profile photo"
        >
          <Avatar
            className={cn("size-full after:hidden", isHeader ? "text-2xl sm:text-3xl" : "text-sm")}
          >
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-espresso font-medium text-brass">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 opacity-0 transition group-hover:opacity-100">
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-bone" />
            ) : (
              <Camera className="size-5 text-bone" />
            )}
          </span>
        </button>

        {variant === "inline" && (
          <Button type="button" variant="outline" size="sm" onClick={pickFile} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
            Change photo
          </Button>
        )}
      </div>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        originalBytes={sourceBytes}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open && cropSrc) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        onComplete={uploadOptimized}
      />
    </>
  );
}
