
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contacts TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS custom_price NUMERIC;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_mode IN ('fixed','bid'));
