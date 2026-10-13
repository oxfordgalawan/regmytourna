# PSGC source files

These JSON files are derived from the [Philippine Standard Geographic Code (PSGC)](https://psa.gov.ph/classification/psgc/) hierarchy, packaged as open JSON in the `philippine-location-json-for-geer` npm package (regions, provinces, city/municipality, barangay lists).

Regenerate flattened rows with:

```bash
npx tsx scripts/build-ph-places.ts
```

Then load into Supabase:

```bash
npx tsx scripts/seed-ph-places.ts
```
