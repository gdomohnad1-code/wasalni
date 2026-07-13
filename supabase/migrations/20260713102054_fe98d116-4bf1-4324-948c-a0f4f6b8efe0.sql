
-- 1) Lock down SECURITY DEFINER functions: revoke broadly, grant back only what's needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ride_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_influencer_ride() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_commission_on_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_super_admin_email() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ads_tick() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_driver_paid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_all_overdue_paid(numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_idle_drivers(integer) FROM PUBLIC, anon, authenticated;

-- Helpers used inside RLS / other SECURITY DEFINER functions: strip anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_permission(uuid, admin_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_driver_see_pending_ride(uuid, uuid) FROM PUBLIC, anon;

-- User-facing RPCs: strip anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.apply_influencer_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_ride_with_change(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_road_alert(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_accept_ride(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hail_instant_ride(uuid, text, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_driver_sos(text, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_driver_location(double precision, double precision, double precision, double precision, double precision, driver_presence, uuid) FROM PUBLIC, anon;

-- 2) Tighten rides UPDATE policy with WITH CHECK, plus a trigger enforcing column immutability
DROP POLICY IF EXISTS rides_update_involved ON public.rides;
CREATE POLICY rides_update_involved ON public.rides
FOR UPDATE
USING (
  auth.uid() = rider_id
  OR auth.uid() = driver_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = rider_id
  OR auth.uid() = driver_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.rides_guard_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  -- No caller context (server-side SECURITY DEFINER RPC or service role): allow
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Completed / cancelled rides are immutable to non-admin end users
  IF OLD.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'ride_finalized_immutable';
  END IF;

  -- Immutable identity / money fields for both rider and driver
  IF NEW.rider_id IS DISTINCT FROM OLD.rider_id THEN
    RAISE EXCEPTION 'cannot_change_rider';
  END IF;
  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.custom_price IS DISTINCT FROM OLD.custom_price
     OR NEW.pricing_mode IS DISTINCT FROM OLD.pricing_mode THEN
    RAISE EXCEPTION 'cannot_change_price';
  END IF;
  IF NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.destination_lat IS DISTINCT FROM OLD.destination_lat
     OR NEW.destination_lng IS DISTINCT FROM OLD.destination_lng
     OR NEW.destination_address IS DISTINCT FROM OLD.destination_address THEN
    RAISE EXCEPTION 'cannot_change_locations';
  END IF;

  -- Driver assignment must not be reassigned to someone else
  IF OLD.driver_id IS NOT NULL AND NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION 'cannot_reassign_driver';
  END IF;
  -- Only the driver themselves can claim a pending ride via direct update (RPC also allowed since it runs with SECURITY DEFINER as postgres and bypasses this check when auth.uid() is present via has_role admin path; direct client claims still restricted)
  IF OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL AND NEW.driver_id <> v_uid THEN
    RAISE EXCEPTION 'cannot_assign_other_driver';
  END IF;

  -- Riders can only cancel; drivers advance status; nobody can set arbitrary status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_uid = OLD.rider_id AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'rider_can_only_cancel';
    END IF;
    IF v_uid = OLD.driver_id AND NEW.status NOT IN ('accepted','in_progress','completed','cancelled') THEN
      RAISE EXCEPTION 'invalid_driver_status_transition';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rides_guard_updates_tr ON public.rides;
CREATE TRIGGER rides_guard_updates_tr
BEFORE UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.rides_guard_updates();

-- 3) Public bucket listing: drop broad SELECT policies (direct public URLs still work via storage CDN)
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS ads_storage_read ON storage.objects;
