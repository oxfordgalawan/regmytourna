/**
 * Browser-side image optimization, run before anything is uploaded:
 * - decodes with EXIF orientation applied (phone photos come out upright)
 * - centre-crops to the target aspect ratio and downsizes (never upscales)
 * - re-encodes as WebP, or JPEG where the browser can't encode WebP (Safari)
 * - drops all metadata (EXIF, GPS) because the canvas only keeps pixels
 */

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export type OptimizedImage = {
  blob: Blob;
  type: "image/webp" | "image/jpeg";
  width: number;
  height: number;
  originalBytes: number;
};

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // some formats (or older browsers) can't be decoded this way; fall through
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function optimizeImage(
  file: File,
  opts: { maxWidth?: number; aspect?: number; quality?: number; maxBytes?: number } = {}
): Promise<OptimizedImage> {
  const { maxWidth = 1600, aspect = 16 / 9, quality = 0.82, maxBytes = 1_800_000 } = opts;
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That image is over 20 MB. Please pick a smaller one.");

  const source = await decode(file).catch(() => {
    throw new Error("This image format can't be opened here. Try a JPG or PNG.");
  });
  const sw = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight : source.height;

  // centre crop to the target aspect ratio
  let cw = sw;
  let ch = Math.round(sw / aspect);
  if (ch > sh) {
    ch = sh;
    cw = Math.round(sh * aspect);
  }
  const cx = Math.round((sw - cw) / 2);
  const cy = Math.round((sh - ch) / 2);

  const width = Math.min(maxWidth, cw);
  const height = Math.round(width / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, width, height);
  if ("close" in source) source.close();

  // WebP first; Safari silently returns PNG for unsupported types, so check
  let q = quality;
  let blob = await toBlob(canvas, "image/webp", q);
  let type: OptimizedImage["type"] = "image/webp";
  if (!blob || blob.type !== "image/webp") {
    type = "image/jpeg";
    blob = await toBlob(canvas, "image/jpeg", q);
  }
  // very detailed photos: step quality down until it fits
  while (blob && blob.size > maxBytes && q > 0.5) {
    q -= 0.08;
    blob = await toBlob(canvas, type, q);
  }
  if (!blob) throw new Error("Your browser couldn't process this image.");
  if (blob.size > maxBytes) throw new Error("This image is too detailed to compress. Try another photo.");

  return { blob, type, width, height, originalBytes: file.size };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
