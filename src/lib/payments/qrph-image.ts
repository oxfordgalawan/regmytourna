import QRCode from "qrcode";

const HTTPS_IMAGE = /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;

/** PayMongo image URL, EMV QR string, or data URL → displayable image src. */
export async function qrContentToDataUrl(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Missing QR content");
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (HTTPS_IMAGE.test(trimmed)) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return QRCode.toDataURL(trimmed, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}