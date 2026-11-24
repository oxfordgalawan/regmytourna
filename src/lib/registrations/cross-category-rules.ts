import { type CategoryType } from "@/lib/categories";

export const BASE_DOUBLES_TYPES = new Set<CategoryType>([
  "mens_doubles",
  "womens_doubles",
  "open_gender",
]);

export const MIXED_DOUBLES_TYPE: CategoryType = "mixed_doubles";

export type ActiveDoublesEntry = {
  registrationId: string;
  divisionId: string;
  divisionName: string;
  categoryType: CategoryType;
};

function isDoublesCategoryType(type: CategoryType): boolean {
  return BASE_DOUBLES_TYPES.has(type) || type === MIXED_DOUBLES_TYPE;
}

export function assertDoublesCrossCategoryAllowed(opts: {
  existingEntries: ActiveDoublesEntry[];
  targetType: CategoryType;
  targetDivisionId?: string;
}): { ok: true } | { ok: false; error: string } {
  const existing = opts.existingEntries.filter((e) => e.divisionId !== opts.targetDivisionId);

  const base = existing.filter((e) => BASE_DOUBLES_TYPES.has(e.categoryType));
  const mixed = existing.filter((e) => e.categoryType === MIXED_DOUBLES_TYPE);
  const targetIsMixed = opts.targetType === MIXED_DOUBLES_TYPE;
  const targetIsBase = BASE_DOUBLES_TYPES.has(opts.targetType);

  if (!isDoublesCategoryType(opts.targetType)) {
    return { ok: true };
  }

  if (existing.length >= 2) {
    return {
      ok: false,
      error:
        "You already have two doubles entries for this event. You can only enter one Men's, Women's, or Open doubles category, plus Mixed Doubles.",
    };
  }

  if (targetIsMixed) {
    if (mixed.length > 0) {
      return {
        ok: false,
        error: `You already have a Mixed Doubles entry for this event (${mixed[0].divisionName}).`,
      };
    }
    return { ok: true };
  }

  if (targetIsBase) {
    if (mixed.length > 0 && base.length > 0) {
      return {
        ok: false,
        error: `You already have ${base[0].divisionName} for this event. With Mixed Doubles, you can only add one Men's, Women's, or Open category.`,
      };
    }
    const sameBase = base.find((e) => e.categoryType === opts.targetType);
    if (sameBase) {
      return {
        ok: false,
        error: `You are already registered in ${sameBase.divisionName}.`,
      };
    }
    const otherBase = base.find((e) => e.categoryType !== opts.targetType);
    if (otherBase) {
      return {
        ok: false,
        error: `You already have ${otherBase.divisionName} for this event. Pick one Men's, Women's, or Open doubles category, or add Mixed Doubles instead.`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}