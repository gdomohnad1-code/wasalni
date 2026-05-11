
CREATE TABLE public.pricing_settings (
  id text PRIMARY KEY DEFAULT 'default',
  oneway_base numeric NOT NULL DEFAULT 30,
  oneway_base_km numeric NOT NULL DEFAULT 3,
  oneway_per_km numeric NOT NULL DEFAULT 3,
  roundtrip_base numeric NOT NULL DEFAULT 60,
  roundtrip_base_km numeric NOT NULL DEFAULT 6,
  roundtrip_per_km numeric NOT NULL DEFAULT 3,
  multistop_hourly numeric NOT NULL DEFAULT 200,
  multistop_min numeric NOT NULL DEFAULT 75,
  commission_rate numeric NOT NULL DEFAULT 0.01,
  multipliers jsonb NOT NULL DEFAULT '{"private":1,"vip":1.5,"package":1,"shared":0.6,"female":1.4}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT one_row CHECK (id = 'default')
);

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_select_all ON public.pricing_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY ps_admin_all ON public.pricing_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER pricing_updated_at BEFORE UPDATE ON public.pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pricing_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_settings;
