
-- Extend enum
ALTER TYPE driver_account_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE driver_account_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE driver_account_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- New columns on driver_documents
ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS id_card_front_url text,
  ADD COLUMN IF NOT EXISTS id_card_back_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS car_type text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fields_to_fix text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS change_request_message text;

-- Storage bucket for driver applications (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('driver-applications', 'driver-applications', false)
  ON CONFLICT (id) DO NOTHING;

-- RLS for driver-applications bucket
DROP POLICY IF EXISTS "driver_apps_select_own_or_admin" ON storage.objects;
CREATE POLICY "driver_apps_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-applications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "driver_apps_insert_own" ON storage.objects;
CREATE POLICY "driver_apps_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "driver_apps_update_own" ON storage.objects;
CREATE POLICY "driver_apps_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'driver-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "driver_apps_delete_own" ON storage.objects;
CREATE POLICY "driver_apps_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'driver-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
