
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS start_pin TEXT;
UPDATE public.rides SET start_pin = LPAD((floor(random()*10000))::int::text, 4, '0') WHERE start_pin IS NULL;
