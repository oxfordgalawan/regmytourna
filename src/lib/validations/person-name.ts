import { z } from "zod";

const trimPart = (s: string) => s.trim().replace(/\s+/g, " ");

export const personNamePartSchema = z
  .string()
  .transform((v) => trimPart(v))
  .pipe(z.string().min(1, "Required"));

export const personNameFieldsSchema = z.object({
  firstName: personNamePartSchema,
  lastName: personNamePartSchema,
});

export function joinPersonName(
  first: string,
  last: string
): { ok: true; value: string } | { ok: false; error: string } {
  const f = trimPart(first);
  const l = trimPart(last);
  if (!f) return { ok: false, error: "First name is required." };
  if (!l) return { ok: false, error: "Last name is required." };
  return { ok: true, value: `${f} ${l}` };
}

/** Prefill signup / partner forms from a stored full name. */
export function splitPersonName(full?: string | null): { firstName: string; lastName: string } {
  const t = full?.trim().replace(/\s+/g, " ");
  if (!t) return { firstName: "", lastName: "" };
  const parts = t.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Server guard when only a joined name string is provided. */
export function assertTwoPartPersonName(name: string): { ok: true; value: string } | { ok: false; error: string } {
  const parts = name.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length < 2 || !parts[0] || !parts.slice(1).join(" ")) {
    return { ok: false, error: "Enter both first and last name." };
  }
  return { ok: true, value: parts.join(" ") };
}