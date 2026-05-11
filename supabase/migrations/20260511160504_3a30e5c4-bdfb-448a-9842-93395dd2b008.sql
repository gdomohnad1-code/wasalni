
-- Influencer / Referral System

CREATE TYPE public.influencer_reward_type AS ENUM ('discount','credit','ride_percentage','fixed_bonus');
CREATE TYPE public.influencer_event_type AS ENUM ('signup','first_ride','ride_use');

CREATE TABLE public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  reward_type public.influencer_reward_type NOT NULL DEFAULT 'fixed_bonus',
  reward_value numeric NOT NULL DEFAULT 0,
  user_discount_value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_influencers_code ON public.influencers(upper(code));

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
CREATE POLICY influencers_admin_all ON public.influencers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY influencers_select_active ON public.influencers FOR SELECT TO authenticated
  USING (active = true);

CREATE TRIGGER influencers_updated_at BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.influencer_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ride_id uuid,
  event_type public.influencer_event_type NOT NULL,
  reward_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_redemp_influencer ON public.influencer_redemptions(influencer_id);
CREATE INDEX idx_redemp_user ON public.influencer_redemptions(user_id);

ALTER TABLE public.influencer_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY redemp_admin_select ON public.influencer_redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY redemp_user_select_own ON public.influencer_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_influencer uuid REFERENCES public.influencers(id);

-- Apply influencer code (called by user after signup or from book screen)
CREATE OR REPLACE FUNCTION public.apply_influencer_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inf record;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_code');
  END IF;

  SELECT * INTO v_inf FROM public.influencers
    WHERE upper(code) = upper(trim(p_code)) AND active = true LIMIT 1;
  IF v_inf.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT referred_by_influencer INTO v_existing FROM public.profiles WHERE id = v_uid;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;

  UPDATE public.profiles SET referred_by_influencer = v_inf.id WHERE id = v_uid;

  INSERT INTO public.influencer_redemptions(influencer_id, user_id, event_type, reward_amount, discount_amount)
  VALUES (v_inf.id, v_uid, 'signup', 0, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'influencer_id', v_inf.id,
    'user_discount_value', v_inf.user_discount_value,
    'reward_type', v_inf.reward_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_influencer_code(text) TO authenticated;

-- Record influencer reward when ride completes
CREATE OR REPLACE FUNCTION public.record_influencer_ride()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inf_id uuid;
  v_inf record;
  v_first boolean := false;
  v_reward numeric := 0;
  v_discount numeric := 0;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT referred_by_influencer INTO v_inf_id FROM public.profiles WHERE id = NEW.rider_id;
  IF v_inf_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_inf FROM public.influencers WHERE id = v_inf_id;
  IF v_inf.id IS NULL THEN RETURN NEW; END IF;

  -- Compute reward
  IF v_inf.reward_type = 'ride_percentage' THEN
    v_reward := ROUND(COALESCE(NEW.price,0) * (v_inf.reward_value/100.0), 2);
  ELSIF v_inf.reward_type = 'fixed_bonus' THEN
    v_reward := v_inf.reward_value;
  ELSIF v_inf.reward_type = 'credit' THEN
    v_reward := v_inf.reward_value;
  ELSE
    v_reward := 0;
  END IF;

  v_discount := COALESCE(v_inf.user_discount_value, 0);

  -- Determine first ride
  SELECT NOT EXISTS (
    SELECT 1 FROM public.influencer_redemptions
    WHERE user_id = NEW.rider_id AND event_type IN ('first_ride','ride_use')
  ) INTO v_first;

  INSERT INTO public.influencer_redemptions(influencer_id, user_id, ride_id, event_type, reward_amount, discount_amount)
  VALUES (v_inf.id, NEW.rider_id, NEW.id, CASE WHEN v_first THEN 'first_ride' ELSE 'ride_use' END, v_reward, v_discount);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_influencer_ride
AFTER UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.record_influencer_ride();

-- Stats view
CREATE OR REPLACE VIEW public.influencer_stats AS
SELECT
  i.id,
  i.name,
  i.phone,
  i.code,
  i.reward_type,
  i.reward_value,
  i.user_discount_value,
  i.active,
  i.created_at,
  COALESCE(s.users_count, 0) AS users_count,
  COALESCE(s.signups_count, 0) AS signups_count,
  COALESCE(s.rides_count, 0) AS rides_count,
  COALESCE(s.total_rewards, 0) AS total_rewards,
  COALESCE(s.total_discounts, 0) AS total_discounts
FROM public.influencers i
LEFT JOIN (
  SELECT
    influencer_id,
    COUNT(DISTINCT user_id) AS users_count,
    COUNT(*) FILTER (WHERE event_type = 'signup') AS signups_count,
    COUNT(*) FILTER (WHERE event_type IN ('first_ride','ride_use')) AS rides_count,
    SUM(reward_amount) AS total_rewards,
    SUM(discount_amount) AS total_discounts
  FROM public.influencer_redemptions
  GROUP BY influencer_id
) s ON s.influencer_id = i.id;

GRANT SELECT ON public.influencer_stats TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.influencer_redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.influencers;
