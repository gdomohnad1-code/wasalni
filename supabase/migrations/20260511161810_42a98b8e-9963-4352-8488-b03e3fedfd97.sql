
CREATE OR REPLACE FUNCTION public.create_commission_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.driver_id IS NOT NULL
     AND NEW.price IS NOT NULL THEN
    SELECT commission_rate INTO v_rate FROM public.pricing_settings WHERE id='default';
    v_rate := COALESCE(v_rate, 0.01);
    INSERT INTO public.driver_commissions (ride_id, driver_id, amount)
    VALUES (NEW.id, NEW.driver_id, ROUND(NEW.price * v_rate, 2))
    ON CONFLICT (ride_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
