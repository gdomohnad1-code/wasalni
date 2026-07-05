
CREATE OR REPLACE FUNCTION public.hail_instant_ride(
  p_driver_id uuid,
  p_destination_address text DEFAULT 'وجهة يحددها الراكب',
  p_destination_lat double precision DEFAULT NULL,
  p_destination_lng double precision DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ride_id uuid;
  v_driver_loc record;
  v_pickup_addr text := 'استلام مباشر على الشارع';
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_price numeric := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_driver_id IS NULL OR p_driver_id = v_uid THEN
    RAISE EXCEPTION 'invalid driver';
  END IF;

  -- Driver must be approved, active, and role=driver
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_documents
    WHERE driver_id = p_driver_id
      AND approved = true
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'driver_not_available';
  END IF;

  -- Driver must not currently be on an active ride
  IF EXISTS (
    SELECT 1 FROM public.rides
    WHERE driver_id = p_driver_id
      AND status IN ('accepted','in_progress')
  ) THEN
    RAISE EXCEPTION 'driver_busy';
  END IF;

  -- Rider must not have an active ride either
  IF EXISTS (
    SELECT 1 FROM public.rides
    WHERE rider_id = v_uid
      AND status IN ('searching','accepted','in_progress')
  ) THEN
    RAISE EXCEPTION 'rider_has_active_ride';
  END IF;

  -- Use driver's latest live location as pickup if available
  SELECT lat, lng INTO v_driver_loc FROM public.driver_locations WHERE driver_id = p_driver_id;
  IF v_driver_loc.lat IS NOT NULL THEN
    v_pickup_lat := v_driver_loc.lat;
    v_pickup_lng := v_driver_loc.lng;
  END IF;

  INSERT INTO public.rides(
    rider_id, driver_id, status,
    pickup_address, pickup_lat, pickup_lng,
    destination_address, destination_lat, destination_lng,
    price, pricing_mode, ride_type,
    accepted_at, started_at
  ) VALUES (
    v_uid, p_driver_id, 'in_progress',
    v_pickup_addr, v_pickup_lat, v_pickup_lng,
    COALESCE(p_destination_address, 'وجهة يحددها الراكب'), p_destination_lat, p_destination_lng,
    v_price, 'street_hail', 'private',
    now(), now()
  ) RETURNING id INTO v_ride_id;

  -- Link ride to driver's location record so realtime driver UI picks it up
  UPDATE public.driver_locations
    SET current_ride_id = v_ride_id, presence = 'busy', updated_at = now()
    WHERE driver_id = p_driver_id;

  RETURN v_ride_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hail_instant_ride(uuid, text, double precision, double precision) TO authenticated;
