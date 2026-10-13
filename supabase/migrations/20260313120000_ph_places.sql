-- Philippine Standard Geographic Code (PSGC) reference places + profile location

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.ph_place_level AS ENUM ('city_municipality', 'barangay');

CREATE TABLE public.ph_places (
  psgc_code TEXT PRIMARY KEY,
  level public.ph_place_level NOT NULL,
  name TEXT NOT NULL,
  region_code TEXT NOT NULL,
  region_name TEXT NOT NULL,
  province_code TEXT,
  province_name TEXT,
  city_municipality_code TEXT NOT NULL,
  city_municipality_name TEXT NOT NULL,
  barangay_code TEXT,
  barangay_name TEXT,
  display_label TEXT NOT NULL,
  search_text TEXT NOT NULL
);

CREATE INDEX ph_places_search_text_trgm_idx ON public.ph_places USING gin (search_text gin_trgm_ops);
CREATE INDEX ph_places_city_municipality_code_idx ON public.ph_places (city_municipality_code);
CREATE INDEX ph_places_region_code_idx ON public.ph_places (region_code);
CREATE INDEX ph_places_level_idx ON public.ph_places (level);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS place_psgc_code TEXT REFERENCES public.ph_places (psgc_code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS place_label TEXT;

ALTER TABLE public.ph_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY ph_places_select_public ON public.ph_places
  FOR SELECT TO anon, authenticated
  USING (true);
