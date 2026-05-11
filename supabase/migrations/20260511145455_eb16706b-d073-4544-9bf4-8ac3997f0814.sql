
-- Enums
CREATE TYPE ad_type AS ENUM ('banner','popup','video','story','notification','fullscreen','reward');
CREATE TYPE ad_placement AS ENUM ('home','book','waiting_driver','driver_app','pre_confirm','post_ride');
CREATE TYPE ad_audience AS ENUM ('riders','drivers','both');
CREATE TYPE ad_media_type AS ENUM ('image','video','gif','link','qr');
CREATE TYPE ad_status AS ENUM ('draft','scheduled','active','paused','ended');
CREATE TYPE ad_event_type AS ENUM ('impression','click','conversion');

-- ads table
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  title text NOT NULL,
  description text,
  type ad_type NOT NULL DEFAULT 'banner',
  placements ad_placement[] NOT NULL DEFAULT '{}',
  target_audience ad_audience NOT NULL DEFAULT 'both',
  target_cities text[] NOT NULL DEFAULT '{}',
  target_min_rides int,
  target_max_rides int,
  media_type ad_media_type NOT NULL DEFAULT 'image',
  media_url text,
  external_link text,
  qr_data text,
  start_at timestamptz,
  end_at timestamptz,
  daily_start_hour int CHECK (daily_start_hour BETWEEN 0 AND 23),
  daily_end_hour int CHECK (daily_end_hour BETWEEN 0 AND 23),
  max_impressions_per_user int DEFAULT 0,
  priority int NOT NULL DEFAULT 0,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_name text,
  status ad_status NOT NULL DEFAULT 'draft',
  auto_rotate boolean NOT NULL DEFAULT true
);

CREATE INDEX ads_status_idx ON public.ads(status);
CREATE INDEX ads_priority_idx ON public.ads(priority DESC);

CREATE TRIGGER ads_set_updated_at
BEFORE UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY ads_admin_all ON public.ads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY ads_select_active ON public.ads
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (start_at IS NULL OR start_at <= now())
    AND (end_at IS NULL OR end_at >= now())
    AND (
      target_audience = 'both'
      OR (target_audience = 'drivers' AND has_role(auth.uid(),'driver'::app_role))
      OR (target_audience = 'riders' AND NOT has_role(auth.uid(),'driver'::app_role))
    )
  );

-- ad_events table
CREATE TABLE public.ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type ad_event_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX ad_events_ad_idx ON public.ad_events(ad_id);
CREATE INDEX ad_events_user_idx ON public.ad_events(user_id);
CREATE INDEX ad_events_type_idx ON public.ad_events(event_type);

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_events_insert_own ON public.ad_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY ad_events_select_admin ON public.ad_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY ad_events_select_own ON public.ad_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('ads','ads',true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ads_storage_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'ads');

CREATE POLICY ads_storage_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ads' AND has_role(auth.uid(),'admin'::app_role));

CREATE POLICY ads_storage_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ads' AND has_role(auth.uid(),'admin'::app_role));

CREATE POLICY ads_storage_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ads' AND has_role(auth.uid(),'admin'::app_role));

-- Tick function: scheduled→active, active→ended; notify admins on end
CREATE OR REPLACE FUNCTION public.ads_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated int := 0;
  v_ended int := 0;
  rec record;
  admin_rec record;
BEGIN
  -- Activate scheduled ads whose start time has arrived
  UPDATE public.ads
    SET status = 'active'
  WHERE status = 'scheduled'
    AND (start_at IS NULL OR start_at <= now());
  GET DIAGNOSTICS v_activated = ROW_COUNT;

  -- End ads past their end_at and notify admins
  FOR rec IN
    SELECT id, title FROM public.ads
    WHERE status IN ('active','scheduled')
      AND end_at IS NOT NULL AND end_at < now()
  LOOP
    UPDATE public.ads SET status = 'ended' WHERE id = rec.id;
    v_ended := v_ended + 1;
    FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications(user_id, title, body)
      VALUES (admin_rec.user_id, 'انتهت حملة إعلانية', 'انتهت الحملة: ' || rec.title);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('activated', v_activated, 'ended', v_ended);
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_events;
