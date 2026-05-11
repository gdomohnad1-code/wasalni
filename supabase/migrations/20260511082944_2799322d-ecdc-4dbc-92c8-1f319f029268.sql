
CREATE TYPE driver_account_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS account_status driver_account_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status withdrawal_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_insert_driver" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'driver'));

CREATE POLICY "withdrawals_select_own_or_admin" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = driver_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "withdrawals_update_admin" ON public.withdrawal_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_withdrawals_status ON public.withdrawal_requests(status);
CREATE INDEX idx_withdrawals_driver ON public.withdrawal_requests(driver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
