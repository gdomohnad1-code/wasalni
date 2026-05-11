-- 1) Demote any current super_admin that isn't the main account
DELETE FROM public.admin_permissions
WHERE permission = 'super_admin'
  AND user_id NOT IN (SELECT id FROM auth.users WHERE lower(email) = 'admin@wasalni.app');

-- 2) Trigger to enforce: only admin@wasalni.app may hold super_admin
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.permission = 'super_admin' THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.user_id;
    IF v_email IS DISTINCT FROM 'admin@wasalni.app' THEN
      RAISE EXCEPTION 'super_admin role is reserved for admin@wasalni.app only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.admin_permissions;
CREATE TRIGGER trg_enforce_single_super_admin
BEFORE INSERT OR UPDATE ON public.admin_permissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_super_admin();

-- 3) Same protection on admin_emails: no other email may have default_permission = 'super_admin'
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.default_permission = 'super_admin' AND lower(NEW.email) <> 'admin@wasalni.app' THEN
    RAISE EXCEPTION 'super_admin default permission is reserved for admin@wasalni.app only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin_email ON public.admin_emails;
CREATE TRIGGER trg_enforce_single_super_admin_email
BEFORE INSERT OR UPDATE ON public.admin_emails
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_super_admin_email();

-- 4) Make sure the main admin email is registered as super_admin
INSERT INTO public.admin_emails (email, default_permission)
VALUES ('admin@wasalni.app', 'super_admin')
ON CONFLICT (email) DO UPDATE SET default_permission = 'super_admin';