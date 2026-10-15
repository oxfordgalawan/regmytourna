"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cropImageToCanvas, optimizeAvatarCanvas } from "@/lib/images/optimize";
import type { OptimizedImage } from "@/lib/images/optimize";

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  originalBytes: number;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: OptimizedImage) => void | Promise<void>;
};

export function AvatarCropDialog({
  open,
  imageSrc,
  originalBytes,
  onOpenChange,
  onComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function save() {
    if (!imageSrc || !croppedAreaPixels || saving) return;
    setSaving(true);
    try {
      const canvas = await cropImageToCanvas(imageSrc, croppedAreaPixels);
      const optimized = await optimizeAvatarCanvas(canvas, originalBytes);
      await onComplete(optimized);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-line bg-ink sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle className="display text-xl text-bone">Crop your photo</DialogTitle>
          <DialogDescription>Drag to reposition. Pinch or use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/40">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brass"
            disabled={saving}
          />
        </label>

        <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || !croppedAreaPixels}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save photo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
