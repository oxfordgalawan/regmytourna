/**
 * Flatten PSGC JSON under data/psgc into data/psgc/places.json for seeding.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  buildPlaceSearchText,
  friendlyRegionName,
  normalizePsgcCode,
} from "../src/lib/places/normalize";

type RegionRow = { reg_code: string; name: string; psgc_code?: string };
type ProvinceRow = { reg_code: string; prov_code: string; name: string; psgc_code?: string };
type CityRow = {
  reg_code: string;
  prov_code: string;
  mun_code: string;
  name: string;
  psgc_code: string;
};
type BarangayRow = {
  reg_code: string;
  prov_code: string;
  mun_code: string;
  brgy_code: string;
  name: string;
};

export type FlatPlaceRow = {
  psgc_code: string;
  level: "city_municipality" | "barangay";
  name: string;
  region_code: string;
  region_name: string;
  province_code: string | null;
  province_name: string | null;
  city_municipality_code: string;
  city_municipality_name: string;
  barangay_code: string | null;
  barangay_name: string | null;
  display_label: string;
  search_text: string;
};

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as T;
}

function main() {
  const regions = loadJson<RegionRow[]>("data/psgc/regions.json");
  const provinces = loadJson<ProvinceRow[]>("data/psgc/provinces.json");
  const cities = loadJson<CityRow[]>("data/psgc/city-mun.json");
  const barangays = loadJson<BarangayRow[]>("data/psgc/barangays.json");

  const regionByCode = new Map(regions.map((r) => [r.reg_code, r]));
  const provinceByCode = new Map(provinces.map((p) => [p.prov_code, p]));
  const cityByMunCode = new Map(cities.map((c) => [c.mun_code, c]));

  const places: FlatPlaceRow[] = [];

  for (const city of cities) {
    const region = regionByCode.get(city.reg_code);
    const province = provinceByCode.get(city.prov_code);
    const regionName = region ? friendlyRegionName(region.name) : city.reg_code;
    const provinceName = province?.name ?? null;
    const psgc = normalizePsgcCode(city.psgc_code);
    const cityCode = normalizePsgcCode(city.mun_code);
    const displayParts = [city.name, provinceName, regionName].filter(Boolean);
    const display_label = displayParts.join(", ");

    places.push({
      psgc_code: psgc,
      level: "city_municipality",
      name: city.name,
      region_code: city.reg_code,
      region_name: regionName,
      province_code: city.prov_code,
      province_name: provinceName,
      city_municipality_code: cityCode,
      city_municipality_name: city.name,
      barangay_code: null,
      barangay_name: null,
      display_label,
      search_text: buildPlaceSearchText([city.name, provinceName, regionName, region?.name]),
    });
  }

  for (const brgy of barangays) {
    const city = cityByMunCode.get(brgy.mun_code);
    if (!city) continue;
    const region = regionByCode.get(brgy.reg_code);
    const province = provinceByCode.get(brgy.prov_code);
    const regionName = region ? friendlyRegionName(region.name) : brgy.reg_code;
    const provinceName = province?.name ?? null;
    const cityCode = normalizePsgcCode(city.mun_code);
    const psgc = normalizePsgcCode(brgy.brgy_code);
    const brgyLabel = brgy.name.replace(/^\s+|\s+$/g, "");
    const display_label = `Brgy ${brgyLabel}, ${city.name}, ${[provinceName, regionName].filter(Boolean).join(", ")}`;

    places.push({
      psgc_code: psgc,
      level: "barangay",
      name: brgyLabel,
      region_code: brgy.reg_code,
      region_name: regionName,
      province_code: brgy.prov_code,
      province_name: provinceName,
      city_municipality_code: cityCode,
      city_municipality_name: city.name,
      barangay_code: normalizePsgcCode(brgy.brgy_code),
      barangay_name: brgyLabel,
      display_label,
      search_text: buildPlaceSearchText([
        brgyLabel,
        city.name,
        provinceName,
        regionName,
        region?.name,
      ]),
    });
  }

  const outPath = resolve(process.cwd(), "data/psgc/places.json");
  writeFileSync(outPath, JSON.stringify(places));
  console.log(`Wrote ${places.length} places to ${outPath}`);
}

main();
