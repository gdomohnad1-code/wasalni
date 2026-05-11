
-- 1) Prevent self privilege escalation
DROP POLICY IF EXISTS roles_insert_own ON public.user_roles;

-- 2) Block direct wallet inserts (must go via server functions)
DROP POLICY IF EXISTS wallet_insert_own ON public.wallet_transactions;

-- 3) Restrict profile visibility to authenticated users only (block anon)
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 4) Influencers: hide from non-admin
DROP POLICY IF EXISTS influencers_select_active ON public.influencers;

-- 5) Driver-docs storage: allow delete by owner or admin
CREATE POLICY "driver_docs_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "driver_docs_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Atomic, authorized ride acceptance
CREATE OR REPLACE FUNCTION public.driver_accept_ride(p_ride_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(v_uid, 'driver'::app_role) THEN
    RAISE EXCEPTION 'driver role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_documents
    WHERE driver_id = v_uid AND approved = true AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'driver not approved or suspended';
  END IF;
  UPDATE public.rides
    SET status='accepted', driver_id=v_uid, accepted_at=now()
    WHERE id=p_ride_id AND status='searching' AND rider_id <> v_uid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.driver_accept_ride(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_ride(uuid) TO authenticated;
