CREATE POLICY "notif_insert_admin"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));