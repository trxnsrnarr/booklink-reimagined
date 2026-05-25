
-- ============ MINI-GAMES ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS game_coin_tenths integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_unlock_limit integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS vip_unlock_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_cycle_started_at timestamptz;

CREATE TABLE IF NOT EXISTS public.game_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_name text NOT NULL,
  reward_tenths integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_rewards_user_date ON public.game_rewards(user_id, claimed_at DESC);
ALTER TABLE public.game_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_rewards_self_select" ON public.game_rewards;
CREATE POLICY "game_rewards_self_select" ON public.game_rewards FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.daily_game_rewards (
  user_id uuid NOT NULL,
  reward_date date NOT NULL DEFAULT (now()::date),
  total_tenths integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, reward_date)
);
ALTER TABLE public.daily_game_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_game_rewards_self_select" ON public.daily_game_rewards;
CREATE POLICY "daily_game_rewards_self_select" ON public.daily_game_rewards FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.game_progress (
  user_id uuid NOT NULL,
  game_name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  best_score integer NOT NULL DEFAULT 0,
  total_plays integer NOT NULL DEFAULT 0,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_name)
);
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_progress_self_select" ON public.game_progress;
CREATE POLICY "game_progress_self_select" ON public.game_progress FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_game_play(_game_name text, _score integer, _level_completed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _row public.game_progress%ROWTYPE;
  _new_level integer; _new_best integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _game_name IS NULL OR length(_game_name) > 50 THEN RAISE EXCEPTION 'invalid_game'; END IF;
  IF _score IS NULL OR _score < 0 OR _score > 10000000 THEN _score := 0; END IF;
  INSERT INTO public.game_progress(user_id, game_name) VALUES (_user, _game_name)
    ON CONFLICT (user_id, game_name) DO NOTHING;
  SELECT * INTO _row FROM public.game_progress WHERE user_id = _user AND game_name = _game_name FOR UPDATE;
  _new_level := _row.level;
  IF _level_completed AND _row.level < 10 THEN _new_level := _row.level + 1; END IF;
  _new_best := GREATEST(_row.best_score, _score);
  UPDATE public.game_progress
    SET level = _new_level, best_score = _new_best, total_plays = _row.total_plays + 1,
        last_played_at = now(), updated_at = now()
    WHERE user_id = _user AND game_name = _game_name;
  RETURN jsonb_build_object('level', _new_level, 'best_score', _new_best,
    'total_plays', _row.total_plays + 1, 'reached_max', _new_level >= 10);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_game_reward(_game_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _cap_tenths integer := 30;
  _used integer; _remaining integer;
  _options integer[] := ARRAY[2, 5, 10];
  _reward integer; _new_tenths integer; _whole integer;
  _new_balance integer; _new_fraction integer; _level integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _game_name IS NULL OR length(_game_name) > 50 THEN RAISE EXCEPTION 'invalid_game'; END IF;
  SELECT level INTO _level FROM public.game_progress WHERE user_id = _user AND game_name = _game_name;
  IF COALESCE(_level, 0) < 10 THEN
    RETURN jsonb_build_object('status','level_required','required_level',10,'current_level',COALESCE(_level,0));
  END IF;
  INSERT INTO public.daily_game_rewards(user_id, reward_date, total_tenths) VALUES (_user, _today, 0)
    ON CONFLICT (user_id, reward_date) DO NOTHING;
  SELECT total_tenths INTO _used FROM public.daily_game_rewards
    WHERE user_id = _user AND reward_date = _today FOR UPDATE;
  _remaining := _cap_tenths - COALESCE(_used, 0);
  IF _remaining <= 0 THEN
    RETURN jsonb_build_object('status','limit_reached','remaining_tenths',0,'cap_tenths',_cap_tenths);
  END IF;
  _reward := _options[1 + floor(random() * array_length(_options,1))::int];
  IF _reward > _remaining THEN _reward := _remaining; END IF;
  INSERT INTO public.game_rewards(user_id, game_name, reward_tenths) VALUES (_user, _game_name, _reward);
  UPDATE public.daily_game_rewards SET total_tenths = total_tenths + _reward
    WHERE user_id = _user AND reward_date = _today;
  UPDATE public.profiles SET game_coin_tenths = game_coin_tenths + _reward, updated_at = now()
    WHERE id = _user RETURNING game_coin_tenths INTO _new_tenths;
  _whole := _new_tenths / 10;
  IF _whole > 0 THEN
    UPDATE public.profiles SET coin_balance = coin_balance + _whole,
      game_coin_tenths = game_coin_tenths - (_whole * 10), updated_at = now()
      WHERE id = _user RETURNING coin_balance, game_coin_tenths INTO _new_balance, _new_fraction;
    INSERT INTO public.transactions(user_id, order_id, amount_idr, coin_amount, bonus_coin, status, tx_type, paid_at, meta)
    VALUES (_user, 'GAME-' || gen_random_uuid()::text, 0, _whole, 0, 'success', 'game_reward', now(),
            jsonb_build_object('game', _game_name, 'tenths', _reward));
  ELSE
    SELECT coin_balance, game_coin_tenths INTO _new_balance, _new_fraction FROM public.profiles WHERE id = _user;
  END IF;
  RETURN jsonb_build_object('status','success','reward_tenths',_reward,
    'used_tenths',COALESCE(_used,0)+_reward,'remaining_tenths',_remaining-_reward,
    'cap_tenths',_cap_tenths,'coin_balance',_new_balance,'fraction_tenths',_new_fraction);
END; $$;

CREATE OR REPLACE FUNCTION public.get_game_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _used integer; _frac integer; _bal integer;
  _total_plays integer; _total_rewards_tenths integer; _highest_level integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT total_tenths INTO _used FROM public.daily_game_rewards
    WHERE user_id = _user AND reward_date = _today;
  SELECT game_coin_tenths, coin_balance INTO _frac, _bal FROM public.profiles WHERE id = _user;
  SELECT COALESCE(SUM(total_plays),0), COALESCE(MAX(level),0) INTO _total_plays, _highest_level
    FROM public.game_progress WHERE user_id = _user;
  SELECT COALESCE(SUM(reward_tenths),0) INTO _total_rewards_tenths
    FROM public.game_rewards WHERE user_id = _user;
  RETURN jsonb_build_object('used_tenths',COALESCE(_used,0),'cap_tenths',30,
    'remaining_tenths',30-COALESCE(_used,0),'fraction_tenths',COALESCE(_frac,0),
    'coin_balance',COALESCE(_bal,0),'total_plays',_total_plays,
    'total_rewards_tenths',_total_rewards_tenths,'highest_level',_highest_level);
END; $$;

-- ============ VIP STORY UNLOCKS ============
CREATE TABLE IF NOT EXISTS public.user_unlocked_vip_stories (
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
ALTER TABLE public.user_unlocked_vip_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uuvs_self_select ON public.user_unlocked_vip_stories;
CREATE POLICY uuvs_self_select ON public.user_unlocked_vip_stories FOR SELECT USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_uuvs_user ON public.user_unlocked_vip_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_uuvs_story ON public.user_unlocked_vip_stories(story_id);

CREATE OR REPLACE FUNCTION public.unlock_vip_story(_story_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _story public.stories;
  _is_vip boolean; _limit integer; _used integer;
  _vip_bonus integer := 50; _is_first boolean := false;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _story FROM public.stories WHERE id = _story_id;
  IF _story IS NULL THEN RAISE EXCEPTION 'story_not_found'; END IF;
  IF NOT _story.is_vip THEN RETURN jsonb_build_object('status','not_vip_story'); END IF;
  IF _story.author_id = _user THEN
    INSERT INTO public.user_unlocked_vip_stories(user_id, story_id) VALUES (_user, _story_id) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','author_owns');
  END IF;
  _is_vip := public.is_vip(_user);
  IF NOT _is_vip THEN RETURN jsonb_build_object('status','vip_required'); END IF;
  IF EXISTS (SELECT 1 FROM public.user_unlocked_vip_stories WHERE user_id = _user AND story_id = _story_id) THEN
    SELECT vip_unlock_limit, vip_unlock_used INTO _limit, _used FROM public.profiles WHERE id = _user;
    RETURN jsonb_build_object('status','already_unlocked','remaining',GREATEST(_limit-_used,0),'limit',_limit);
  END IF;
  SELECT vip_unlock_limit, vip_unlock_used INTO _limit, _used FROM public.profiles WHERE id = _user FOR UPDATE;
  IF COALESCE(_used,0) >= COALESCE(_limit,0) THEN
    RETURN jsonb_build_object('status','limit_reached','remaining',0,'limit',_limit);
  END IF;
  INSERT INTO public.user_unlocked_vip_stories(user_id, story_id) VALUES (_user, _story_id);
  UPDATE public.profiles SET vip_unlock_used = COALESCE(vip_unlock_used,0)+1, updated_at = now() WHERE id = _user;
  IF _story.author_id IS NOT NULL THEN
    INSERT INTO public.author_earnings(user_id, total_earned, balance)
    VALUES (_story.author_id, _vip_bonus, _vip_bonus)
    ON CONFLICT (user_id) DO UPDATE SET
      total_earned = author_earnings.total_earned + EXCLUDED.total_earned,
      balance = author_earnings.balance + EXCLUDED.balance,
      updated_at = now();
    INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (_story.author_id,'earning','Pembaca VIP baru!',
      'Kamu mendapat '||_vip_bonus||' coin dari pembaca VIP cerita "'||_story.title||'"',
      '/story/'||_story.slug);
  END IF;
  UPDATE public.stories SET unlock_count = unlock_count + 1 WHERE id = _story_id;
  RETURN jsonb_build_object('status','success','remaining',GREATEST(_limit-(_used+1),0),'limit',_limit,'first',_is_first);
END; $$;

REVOKE EXECUTE ON FUNCTION public.unlock_vip_story(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_vip_story(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_game_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_game_reward(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_game_play(text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_game_play(text, integer, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_game_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_stats() TO authenticated;
