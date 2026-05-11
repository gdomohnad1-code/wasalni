
-- Commissions ledger
CREATE TYPE commission_status AS ENUM ('unpaid', 'paid');

CREATE TABLE public.driver_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL UNIQUE,
  driver_id uuid NOT NULL,
  amount numeric NOT NULL,
  status commission_status NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz,
  paid_by uuid,
  batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commissions_driver_status ON public.driver_commissions(driver_id, status);
CREATE INDEX idx_commissions_status_created ON public.driver_commissions(status, created_at);

ALTER TABLE public.driver_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_admin_all" ON public.driver_commissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "commissions_driver_select_own" ON public.driver_commissions
  FOR SELECT USING (auth.uid() = driver_id);

-- Trigger: on ride completed → insert 1% commission
CREATE OR REPLACE FUNCTION public.create_commission_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.driver_id IS NOT NULL
     AND NEW.price IS NOT NULL THEN
    INSERT INTO public.driver_commissions (ride_id, driver_id, amount)
    VALUES (NEW.id, NEW.driver_id, ROUND(NEW.price * 0.01, 2))
    ON CONFLICT (ride_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_commission ON public.rides;
CREATE TRIGGER trg_create_commission
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.create_commission_on_complete();

-- Backfill existing completed rides
INSERT INTO public.driver_commissions (ride_id, driver_id, amount)
SELECT id, driver_id, ROUND(price * 0.01, 2)
FROM public.rides
WHERE status = 'completed' AND driver_id IS NOT NULL AND price IS NOT NULL
ON CONFLICT (ride_id) DO NOTHING;

-- Driver doc fields for reminders / overdue tracking
ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS dues_since timestamptz;

-- Mark all unpaid for a driver as paid
CREATE OR REPLACE FUNCTION public.mark_driver_paid(p_driver_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_batch uuid := gen_random_uuid();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.driver_commissions
    SET status = 'paid', paid_at = now(), paid_by = auth.uid(), batch_id = v_batch
    WHERE driver_id = p_driver_id AND status = 'unpaid';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Reactivate if was suspended for unpaid dues
  UPDATE public.driver_documents
    SET account_status = 'active',
        suspension_reason = NULL,
        dues_since = NULL,
        last_reminder_at = NULL
    WHERE driver_id = p_driver_id
      AND account_status = 'suspended'
      AND suspension_reason ILIKE '%مستحقات%';

  RETURN v_count;
END;
$$;

-- Bulk pay all overdue (>= threshold)
CREATE OR REPLACE FUNCTION public.mark_all_overdue_paid(p_min_amount numeric DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_driver record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR v_driver IN
    SELECT driver_id, SUM(amount) AS total
    FROM public.driver_commissions
    WHERE status = 'unpaid'
    GROUP BY driver_id
    HAVING SUM(amount) >= p_min_amount
  LOOP
    PERFORM public.mark_driver_paid(v_driver.driver_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
