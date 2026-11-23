/**
 *   npx jiti scripts/check-categories.ts
 */
import assert from "node:assert/strict";
import {
  categoryGenderLabel,
  categoryName,
  parseCategoryFromDivisionName,
} from "../src/lib/categories";

assert.deepEqual(parseCategoryFromDivisionName("Men's Doubles · Beginner"), {
  type: "mens_doubles",
  title: "Beginner",
});
assert.deepEqual(parseCategoryFromDivisionName("Open Gender · Low Intermediate"), {
  type: "open_gender",
  title: "Low Intermediate",
});
assert.deepEqual(parseCategoryFromDivisionName("Open Gender"), {
  type: "open_gender",
  title: "",
});
assert.equal(categoryGenderLabel("Women's Doubles · Low Intermediate"), "Women's Doubles");
assert.equal(categoryName("open_gender", "Novice"), "Open Gender · Novice");

console.log("✓ category name parse round-trip checks");