-- Enum for admin sub-roles
DO $$ BEGIN
  CREATE TYPE public.admin_permission AS ENUM (
    'super_admin',      -- المسؤول الرئيسي (كل الصلاحيات + إدارة المسؤولين)
    'assigner',         -- مسؤول التعيين (الموافقة على السائقين والوثائق)
    'full_control',     -- تحكم كامل (كل شيء عدا إدارة المسؤولين)
    'viewer',           -- معاينة فقط (قراءة فقط)
    'notifications',    -- إدارة الإشعارات والإعلانات
    'collections'       -- مسؤول التحصيل (المستحقات والمدفوعات)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table mapping admin user -> permission(s)
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission public.admin_permission NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Helper: check if user has specific admin permission (or is super_admin)
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _perm public.admin_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE user_id = _user_id
      AND (permission = _perm OR permission = 'super_admin')
  );
$$;

-- Helper: is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE user_id = _user_id AND permission = 'super_admin'
  );
$$;

-- RLS: admins can read their own permissions; super_admins manage all
CREATE POLICY admin_perm_select_own ON public.admin_permissions
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY admin_perm_super_all ON public.admin_permissions
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Auto-grant super_admin to admin@wasalni.app on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  is_admin boolean;
  is_main_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    'WSL' || substr(md5(NEW.id::text), 1, 6)
  );

  SELECT EXISTS(SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email))
    INTO is_admin;

  is_main_admin := lower(NEW.email) = 'admin@wasalni.app';

  IF is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    IF is_main_admin THEN
      INSERT INTO public.admin_permissions (user_id, permission)
      VALUES (NEW.id, 'super_admin')
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.admin_permissions (user_id, permission)
      VALUES (NEW.id, 'viewer')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rider');
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: grant super_admin to existing admin@wasalni.app if exists
INSERT INTO public.admin_permissions (user_id, permission)
SELECT u.id, 'super_admin'::public.admin_permission
FROM auth.users u
WHERE lower(u.email) = 'admin@wasalni.app'
ON CONFLICT DO NOTHING;

-- Backfill: any existing admin without a permission gets viewer
INSERT INTO public.admin_permissions (user_id, permission)
SELECT ur.user_id, 'viewer'::public.admin_permission
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = ur.user_id
  )
ON CONFLICT DO NOTHING;