import { z } from "zod";

const PH_MOBILE_RE = /^09\d{9}$/;

/** Strip formatting; map +63/63/9… variants to 09XXXXXXXXX. */
export function normalizePhilippineMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 10 && digits.startsWith("9")) {
    digits = `0${digits}`;
  }
  return PH_MOBILE_RE.test(digits) ? digits : null;
}

export function parsePhilippineMobileRequired(
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Mobile number is required." };
  }
  const value = normalizePhilippineMobile(trimmed);
  if (!value) {
    return { ok: false, error: "Use 11 digits starting with 09." };
  }
  return { ok: true, value };
}

export const philippineMobileSchema = z
  .string()
  .min(1, "Mobile number is required")
  .superRefine((val, ctx) => {
    if (!normalizePhilippineMobile(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use 11 digits starting with 09." });
    }
  })
  .transform((val) => normalizePhilippineMobile(val)!);