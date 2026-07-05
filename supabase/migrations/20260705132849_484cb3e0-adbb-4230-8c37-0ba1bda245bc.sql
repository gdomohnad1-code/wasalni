
-- Helper: haversine distance in km
CREATE OR REPLACE FUNCTION public.km_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians((b_lat - a_lat) / 2)), 2) +
    cos(radians(a_lat)) * cos(radians(b_lat)) *
    power(sin(radians((b_lng - a_lng) / 2)), 2)
  ));
$$;

-- Security-definer gate: does this authenticated driver qualify to see this pending ride?
CREATE OR REPLACE FUNCTION public.can_driver_see_pending_ride(_ride_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride record;
  v_loc  record;
  v_ok_docs boolean;
BEGIN
  IF _driver_id IS NULL THEN RETURN false; END IF;
  IF NOT public.has_role(_driver_id, 'driver'::app_role) THEN RETURN false; END IF;

  SELECT approved AND account_status = 'active'
    INTO v_ok_docs
    FROM public.driver_documents
    WHERE driver_id = _driver_id;
  IF NOT COALESCE(v_ok_docs, false) THEN RETURN false; END IF;

  SELECT lat, lng, presence, updated_at, last_geofence_id, in_zone
    INTO v_loc
    FROM public.driver_locations
    WHERE driver_id = _driver_id;
  IF v_loc.lat IS NULL THEN RETURN false; END IF;
  IF v_loc.presence <> 'available' THEN RETURN false; END IF;
  IF v_loc.updated_at < now() - interval '3 minutes' THEN RETURN false; END IF;

  SELECT id, pickup_lat, pickup_lng, status
    INTO v_ride
    FROM public.rides
    WHERE id = _ride_id;
  IF v_ride.id IS NULL OR v_ride.status <> 'searching' THEN RETURN false; END IF;

  -- Same geofence OR within 20 km of pickup
  IF v_ride.pickup_lat IS NULL OR v_ride.pickup_lng IS NULL THEN
    RETURN v_loc.in_zone;
  END IF;

  IF v_loc.last_geofence_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.geofences g
    WHERE g.id = v_loc.last_geofence_id
      AND g.active
      AND public.point_in_polygon(v_ride.pickup_lat, v_ride.pickup_lng, g.polygon)
  ) THEN
    RETURN true;
  END IF;

  RETURN public.km_between(v_loc.lat, v_loc.lng, v_ride.pickup_lat, v_ride.pickup_lng) <= 20;
END;
$$;

REVOKE ALL ON FUNCTION public.can_driver_see_pending_ride(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_driver_see_pending_ride(uuid, uuid) TO authenticated;

-- Replace the broad rides SELECT policy with a scoped one
DROP POLICY IF EXISTS rides_select_involved ON public.rides;
CREATE POLICY rides_select_involved ON public.rides
FOR SELECT
USING (
  auth.uid() = rider_id
  OR auth.uid() = driver_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    status = 'searching'::ride_status
    AND public.can_driver_see_pending_ride(id, auth.uid())
  )
);

-- Same gate for accepting (UPDATE) a searching ride
DROP POLICY IF EXISTS rides_update_involved ON public.rides;
CREATE POLICY rides_update_involved ON public.rides
FOR UPDATE
USING (
  auth.uid() = rider_id
  OR auth.uid() = driver_id
  OR (
    status = 'searching'::ride_status
    AND public.can_driver_see_pending_ride(id, auth.uid())
  )
);
