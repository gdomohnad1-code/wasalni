
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE public.ride_status AS ENUM ('searching', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.ride_type AS ENUM ('private', 'shared', 'package', 'female', 'vip');
CREATE TYPE public.tx_type AS ENUM ('topup', 'ride_payment', 'refund', 'referral_bonus');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  wallet_balance NUMERIC NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  rating NUMERIC DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ DRIVER_DOCUMENTS ============
CREATE TABLE public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  driver_license_url TEXT,
  car_license_url TEXT,
  car_photo_url TEXT,
  car_model TEXT,
  car_plate TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- ============ RIDES ============
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC,
  pickup_lng NUMERIC,
  destination_address TEXT NOT NULL,
  destination_lat NUMERIC,
  destination_lng NUMERIC,
  ride_type ride_type NOT NULL DEFAULT 'private',
  status ride_status NOT NULL DEFAULT 'searching',
  distance_km NUMERIC,
  duration_min INT,
  price NUMERIC NOT NULL,
  round_trip BOOLEAN DEFAULT false,
  rating INT,
  rating_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- ============ WALLET_TRANSACTIONS ============
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type tx_type NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- ============ CHAT_MESSAGES ============
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_insert_own" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- driver_documents
CREATE POLICY "docs_own" ON public.driver_documents FOR ALL USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "docs_admin" ON public.driver_documents FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- rides
CREATE POLICY "rides_select_involved" ON public.rides FOR SELECT
  USING (auth.uid() = rider_id OR auth.uid() = driver_id OR (status = 'searching' AND public.has_role(auth.uid(), 'driver')) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "rides_insert_rider" ON public.rides FOR INSERT WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "rides_update_involved" ON public.rides FOR UPDATE
  USING (auth.uid() = rider_id OR auth.uid() = driver_id OR (status = 'searching' AND public.has_role(auth.uid(), 'driver')));

-- wallet_transactions
CREATE POLICY "wallet_select_own" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_insert_own" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "chat_select_involved" ON public.chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())));
CREATE POLICY "chat_insert_involved" ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())));

-- notifications
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============ TRIGGERS ============

-- handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    'WSL' || substr(md5(NEW.id::text), 1, 6)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rider');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-docs', 'driver-docs', false);

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "docs_user_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "docs_user_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'driver-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
