
CREATE OR REPLACE FUNCTION public.complete_ride_with_change(
  p_ride_id uuid,
  p_received_cash numeric,
  p_change_to_wallet numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ride record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT id, rider_id, driver_id, status, price
    INTO v_ride FROM public.rides WHERE id = p_ride_id;

  IF v_ride.id IS NULL THEN RAISE EXCEPTION 'ride_not_found'; END IF;
  IF v_ride.driver_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'not_your_ride'; END IF;
  IF v_ride.status NOT IN ('in_progress','accepted') THEN RAISE EXCEPTION 'invalid_ride_state'; END IF;

  UPDATE public.rides
    SET status = 'completed', completed_at = now()
    WHERE id = p_ride_id;

  IF COALESCE(p_change_to_wallet, 0) > 0 THEN
    UPDATE public.profiles
      SET wallet_balance = wallet_balance + p_change_to_wallet
      WHERE id = v_ride.rider_id;

    INSERT INTO public.wallet_transactions(user_id, type, amount, description, ride_id)
    VALUES (
      v_ride.rider_id,
      'refund'::tx_type,
      p_change_to_wallet,
      'باقي فكة رحلة أُودع تلقائياً',
      p_ride_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_ride_with_change(uuid, numeric, numeric) TO authenticated;
