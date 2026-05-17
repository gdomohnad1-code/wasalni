ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS driver_rating integer,
  ADD COLUMN IF NOT EXISTS driver_rating_comment text;

ALTER TABLE public.rides
  DROP CONSTRAINT IF EXISTS rides_driver_rating_check;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_driver_rating_check CHECK (driver_rating IS NULL OR (driver_rating BETWEEN 1 AND 5));

ALTER TABLE public.rides
  DROP CONSTRAINT IF EXISTS rides_rating_check;
ALTER TABLE public.rides
  ADD CONSTRAINT rides_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));