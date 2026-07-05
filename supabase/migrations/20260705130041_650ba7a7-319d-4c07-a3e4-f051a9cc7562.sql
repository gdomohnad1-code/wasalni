
CREATE TYPE public.road_alert_type AS ENUM ('bump','police','accident','traffic','hazard','closure');

CREATE TABLE public.road_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  type public.road_alert_type NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  note text,
  confirms integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX road_alerts_expires_idx ON public.road_alerts(expires_at);
CREATE INDEX road_alerts_geo_idx ON public.road_alerts(lat, lng);

GRANT SELECT, INSERT, DELETE ON public.road_alerts TO authenticated;
GRANT ALL ON public.road_alerts TO service_role;

ALTER TABLE public.road_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active road alerts"
  ON public.road_alerts FOR SELECT
  TO authenticated
  USING (expires_at > now());

CREATE POLICY "Signed-in users can create their own alerts"
  ON public.road_alerts FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own alerts"
  ON public.road_alerts FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.confirm_road_alert(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_expires timestamptz;
  v_confirms integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.road_alerts
    SET confirms = confirms + 1,
        expires_at = LEAST(created_at + interval '4 hours', expires_at + interval '30 minutes')
    WHERE id = p_id AND expires_at > now()
    RETURNING confirms INTO v_confirms;
  IF v_confirms IS NULL THEN RAISE EXCEPTION 'alert_not_found_or_expired'; END IF;
  RETURN v_confirms;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_road_alert(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.road_alerts;
