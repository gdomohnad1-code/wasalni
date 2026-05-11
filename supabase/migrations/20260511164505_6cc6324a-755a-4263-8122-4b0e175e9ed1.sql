ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS target_area_lat double precision,
  ADD COLUMN IF NOT EXISTS target_area_lng double precision,
  ADD COLUMN IF NOT EXISTS target_area_radius_m integer;