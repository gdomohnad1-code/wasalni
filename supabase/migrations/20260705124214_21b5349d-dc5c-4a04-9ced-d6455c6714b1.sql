
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS silent_ride BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS ac_preference TEXT NOT NULL DEFAULT 'any' CHECK (ac_preference IN ('any','on','off'));
