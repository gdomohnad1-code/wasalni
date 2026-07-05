
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS home_dest_lat DOUBLE PRECISION;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS home_dest_lng DOUBLE PRECISION;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS home_dest_address TEXT;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS home_mode_active BOOLEAN NOT NULL DEFAULT false;
