
ALTER TABLE public.admin_emails
  ADD COLUMN IF NOT EXISTS default_permission admin_permission NOT NULL DEFAULT 'viewer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
  is_main_admin boolean;
  v_perm admin_permission;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    'WSL' || substr(md5(NEW.id::text), 1, 6)
  );

  SELECT default_permission INTO v_perm
    FROM public.admin_emails WHERE lower(email) = lower(NEW.email) LIMIT 1;

  is_admin := v_perm IS NOT NULL;
  is_main_admin := lower(NEW.email) = 'admin@wasalni.app';

  IF is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.admin_permissions (user_id, permission)
    VALUES (NEW.id, CASE WHEN is_main_admin THEN 'super_admin'::admin_permission ELSE v_perm END)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rider');
  END IF;

  RETURN NEW;
END;
$function$;
