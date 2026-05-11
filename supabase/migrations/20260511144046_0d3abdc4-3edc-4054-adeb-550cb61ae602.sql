
CREATE OR REPLACE FUNCTION public.notify_ride_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.rider_id, 'تم الحجز', 'بنبحث عن سائق قريب منك — ' || NEW.pickup_address);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (NEW.rider_id, 'السائق قبل رحلتك', 'السائق في طريقه إليك');
    ELSIF NEW.status = 'in_progress' THEN
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (NEW.rider_id, 'بدأت الرحلة', 'في الطريق للوجهة');
      IF NEW.driver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body)
        VALUES (NEW.driver_id, 'بدأت الرحلة', 'الرحلة بدأت بنجاح');
      END IF;
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (NEW.rider_id, 'اكتملت الرحلة', 'شكراً لاستخدامك وصلني');
      IF NEW.driver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body)
        VALUES (NEW.driver_id, 'اكتملت الرحلة', 'تم تسجيل عمولة الرحلة');
      END IF;
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (NEW.rider_id, 'تم إلغاء الرحلة', 'تم إلغاء رحلتك');
      IF NEW.driver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body)
        VALUES (NEW.driver_id, 'تم إلغاء الرحلة', 'تم إلغاء الرحلة');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ride_event ON public.rides;
CREATE TRIGGER trg_notify_ride_event
AFTER INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.notify_ride_event();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow users to delete their own notifications (for clear functionality)
DROP POLICY IF EXISTS notif_delete_own ON public.notifications;
CREATE POLICY notif_delete_own ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
