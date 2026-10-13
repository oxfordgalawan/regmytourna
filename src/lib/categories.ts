import { z } from "zod";
import { bracketConfigSchema } from "@/lib/bracket-format";

/**
 * A tournament "category" is stored as a row in `tournament_divisions`.
 * The play type (e.g. Men's Doubles) and the organizer's skill title
 * (e.g. "Low Intermediate") are combined into the division name, which keeps
 * `UNIQUE (tournament_id, name)` meaningful: "Novice" can exist once per type.
 */
export const CATEGORY_TYPES = [
  { value: "mens_doubles", label: "Men's Doubles", short: "MD", format: "doubles" },
  { value: "womens_doubles", label: "Women's Doubles", short: "WD", format: "doubles" },
  { value: "mixed_doubles", label: "Mixed Doubles", short: "XD", format: "doubles" },
  { value: "mens_singles", label: "Men's Singles", short: "MS", format: "singles" },
  { value: "womens_singles", label: "Women's Singles", short: "WS", format: "singles" },
] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number]["value"];

export const SPORTS = [{ value: "pickleball", label: "Pickleball" }] as const;

export function categoryType(value: string) {
  return CATEGORY_TYPES.find((t) => t.value === value) ?? CATEGORY_TYPES[0];
}

export function categoryName(type: string, title: string) {
  const t = title.trim();
  return t ? `${categoryType(type).label} · ${t}` : categoryType(type).label;
}

/** "teams" for doubles, "players" for singles. */
export function entrantNoun(format: string, count = 2) {
  const noun = format === "singles" ? "player" : "team";
  return count === 1 ? noun : `${noun}s`;
}

export const categoryInputSchema = z.object({
  title: z.string().trim().max(60).default(""),
  type: z.enum(CATEGORY_TYPES.map((t) => t.value) as [CategoryType, ...CategoryType[]]),
  capacity: z.coerce.number().int().positive().max(512).optional(),
  entryFeeCents: z.coerce.number().int().min(0).optional(),
  bracketConfig: bracketConfigSchema.optional(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoriesPayloadSchema = z
  .array(categoryInputSchema)
  .min(1, "Add at least one category")
  .max(40)
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.forEach((c, i) => {
      const name = categoryName(c.type, c.title).toLowerCase();
      if (seen.has(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "title"],
          message: `"${categoryName(c.type, c.title)}" is listed twice`,
        });
      }
      seen.add(name);
    });
  });
