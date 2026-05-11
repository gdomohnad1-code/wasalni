
CREATE TYPE complaint_status AS ENUM ('new', 'in_progress', 'resolved', 'closed');
CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ride_id UUID,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status complaint_status NOT NULL DEFAULT 'new',
  priority complaint_priority NOT NULL DEFAULT 'medium',
  admin_response TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_insert_own" ON public.complaints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "complaints_select_own" ON public.complaints
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "complaints_update_admin" ON public.complaints
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_user_id ON public.complaints(user_id);
