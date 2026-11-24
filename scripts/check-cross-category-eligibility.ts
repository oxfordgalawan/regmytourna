/**
 *   npx jiti scripts/check-cross-category-eligibility.ts
 */
import assert from "node:assert/strict";
import {
  assertDoublesCrossCategoryAllowed,
  type ActiveDoublesEntry,
} from "../src/lib/registrations/cross-category-rules";

function entry(type: ActiveDoublesEntry["categoryType"], name = "Cat"): ActiveDoublesEntry {
  return {
    registrationId: "r1",
    divisionId: "d1",
    divisionName: name,
    categoryType: type,
  };
}

function allows(existing: ActiveDoublesEntry[], target: ActiveDoublesEntry["categoryType"]) {
  const v = assertDoublesCrossCategoryAllowed({ existingEntries: existing, targetType: target });
  assert.equal(v.ok, true);
}

function blocks(existing: ActiveDoublesEntry[], target: ActiveDoublesEntry["categoryType"]) {
  const v = assertDoublesCrossCategoryAllowed({ existingEntries: existing, targetType: target });
  assert.equal(v.ok, false);
}

allows([], "mixed_doubles");
allows([], "mens_doubles");
allows([entry("mens_doubles", "Men's Doubles · A")], "mixed_doubles");
allows([entry("mixed_doubles", "Mixed · A")], "mens_doubles");
blocks([entry("womens_doubles")], "open_gender");
blocks([entry("mens_doubles")], "womens_doubles");
blocks([entry("mens_doubles")], "open_gender");
blocks([entry("mixed_doubles")], "mixed_doubles");
blocks([entry("mens_doubles"), entry("mixed_doubles", "Mixed")], "womens_doubles");
blocks([entry("mens_doubles"), entry("mixed_doubles", "Mixed")], "mixed_doubles");

console.log("✓ cross-category eligibility matrix");