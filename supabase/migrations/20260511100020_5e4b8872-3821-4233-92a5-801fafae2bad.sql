-- ============================================================
-- DRIVER LIVE TRACKING SCHEMA
-- ============================================================

-- Status enum for live driver presence
DO $$ BEGIN
  CREATE TYPE public.driver_presence AS ENUM ('available', 'busy', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Alert types
DO $$ BEGIN
  CREATE TYPE public.driver_alert_type AS ENUM ('sos', 'idle', 'out_of_zone', 'speeding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- driver_locations  (one row per driver, latest position)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id uuid PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  presence public.driver_presence NOT NULL DEFAULT 'offline',
  current_ride_id uuid,
  last_geofence_id uuid,
  in_zone boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dl_driver_upsert ON public.driver_locations;
CREATE POLICY dl_driver_upsert ON public.driver_locations
  FOR ALL TO authenticated
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS dl_select_admin_or_self ON public.driver_locations;
CREATE POLICY dl_select_admin_or_self ON public.driver_locations
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_driver_locations_presence ON public.driver_locations(presence);
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON public.driver_locations(updated_at DESC);

-- ============================================================
-- driver_location_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_location_history (
  id bigserial PRIMARY KEY,
  driver_id uuid NOT NULL,
  ride_id uuid,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dlh_insert_self ON public.driver_location_history;
CREATE POLICY dlh_insert_self ON public.driver_location_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS dlh_select_admin_or_self ON public.driver_location_history;
CREATE POLICY dlh_select_admin_or_self ON public.driver_location_history
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_dlh_driver_time ON public.driver_location_history(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlh_ride ON public.driver_location_history(ride_id);

-- ============================================================
-- geofences (delivery zones)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- GeoJSON polygon: { type: 'Polygon', coordinates: [[[lng,lat],...]] }
  polygon jsonb NOT NULL,
  color text DEFAULT '#3b82f6',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gf_select_all_auth ON public.geofences;
CREATE POLICY gf_select_all_auth ON public.geofences
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS gf_admin_manage ON public.geofences;
CREATE POLICY gf_admin_manage ON public.geofences
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_geofences_updated_at
  BEFORE UPDATE ON public.geofences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- driver_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  ride_id uuid,
  type public.driver_alert_type NOT NULL,
  message text,
  lat double precision,
  lng double precision,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS da_insert_self ON public.driver_alerts;
CREATE POLICY da_insert_self ON public.driver_alerts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS da_select_admin_or_self ON public.driver_alerts;
CREATE POLICY da_select_admin_or_self ON public.driver_alerts
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS da_admin_update ON public.driver_alerts;
CREATE POLICY da_admin_update ON public.driver_alerts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_alerts_open ON public.driver_alerts(resolved, created_at DESC);

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_alerts;

-- Replica identity full so UPDATE events include all fields
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.driver_alerts REPLICA IDENTITY FULL;

-- ============================================================
-- Helper: point in polygon (ray casting) for geofence checks
-- ============================================================
CREATE OR REPLACE FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  ring jsonb;
  i int;
  n int;
  inside boolean := false;
  xi double precision; yi double precision;
  xj double precision; yj double precision;
BEGIN
  ring := p_polygon -> 'coordinates' -> 0;
  IF ring IS NULL THEN RETURN false; END IF;
  n := jsonb_array_length(ring);
  IF n < 3 THEN RETURN false; END IF;
  FOR i IN 0..n-1 LOOP
    xi := (ring -> i ->> 0)::double precision;
    yi := (ring -> i ->> 1)::double precision;
    xj := (ring -> ((i - 1 + n) % n) ->> 0)::double precision;
    yj := (ring -> ((i - 1 + n) % n) ->> 1)::double precision;
    IF ((yi > p_lat) <> (yj > p_lat)) AND
       (p_lng < (xj - xi) * (p_lat - yi) / NULLIF((yj - yi), 0) + xi) THEN
      inside := NOT inside;
    END IF;
  END LOOP;
  RETURN inside;
END $$;

-- ============================================================
-- RPC: upsert driver location (called by driver every few seconds)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_driver_location(
  p_lat double precision,
  p_lng double precision,
  p_heading double precision DEFAULT NULL,
  p_speed double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_presence public.driver_presence DEFAULT 'available',
  p_ride_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_in_zone boolean := true;
  v_zone_id uuid;
  v_active_zones int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- Check geofences (only if any active zones exist)
  SELECT count(*) INTO v_active_zones FROM public.geofences WHERE active;
  IF v_active_zones > 0 THEN
    v_in_zone := false;
    SELECT id INTO v_zone_id FROM public.geofences
      WHERE active AND public.point_in_polygon(p_lat, p_lng, polygon)
      LIMIT 1;
    IF v_zone_id IS NOT NULL THEN v_in_zone := true; END IF;
  END IF;

  INSERT INTO public.driver_locations(driver_id, lat, lng, heading, speed, accuracy, presence, current_ride_id, last_geofence_id, in_zone, updated_at)
  VALUES (v_uid, p_lat, p_lng, p_heading, p_speed, p_accuracy, p_presence, p_ride_id, v_zone_id, v_in_zone, now())
  ON CONFLICT (driver_id) DO UPDATE SET
    lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
    speed = excluded.speed, accuracy = excluded.accuracy,
    presence = excluded.presence, current_ride_id = excluded.current_ride_id,
    last_geofence_id = excluded.last_geofence_id, in_zone = excluded.in_zone,
    updated_at = now();

  INSERT INTO public.driver_location_history(driver_id, ride_id, lat, lng, speed)
  VALUES (v_uid, p_ride_id, p_lat, p_lng, p_speed);

  -- Out of zone alert (rate-limited: only one open per driver)
  IF v_active_zones > 0 AND NOT v_in_zone THEN
    INSERT INTO public.driver_alerts(driver_id, type, message, lat, lng)
    SELECT v_uid, 'out_of_zone', 'السائق خارج نطاق التوصيل', p_lat, p_lng
    WHERE NOT EXISTS (
      SELECT 1 FROM public.driver_alerts
      WHERE driver_id = v_uid AND type = 'out_of_zone' AND NOT resolved
        AND created_at > now() - interval '30 minutes'
    );
  END IF;
END $$;

-- ============================================================
-- RPC: trigger SOS
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_driver_sos(p_message text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_ride uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT current_ride_id INTO v_ride FROM public.driver_locations WHERE driver_id = v_uid;
  INSERT INTO public.driver_alerts(driver_id, ride_id, type, message, lat, lng)
  VALUES (v_uid, v_ride, 'sos', COALESCE(p_message, 'حالة طوارئ'), p_lat, p_lng)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ============================================================
-- RPC: idle detection (called periodically; rate-limited)
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_idle_drivers(p_minutes int DEFAULT 20)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR rec IN
    SELECT driver_id, lat, lng FROM public.driver_locations
    WHERE presence = 'available'
      AND updated_at < now() - (p_minutes || ' minutes')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.driver_alerts
        WHERE driver_id = driver_locations.driver_id
          AND type = 'idle' AND NOT resolved
          AND created_at > now() - interval '1 hour'
      )
  LOOP
    INSERT INTO public.driver_alerts(driver_id, type, message, lat, lng)
    VALUES (rec.driver_id, 'idle', 'سائق متوقف لأكثر من ' || p_minutes || ' دقيقة', rec.lat, rec.lng);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.update_driver_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_driver_sos TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_idle_drivers TO authenticated;
