
-- 1. game_progress: track last rewarded milestone
ALTER TABLE public.game_progress
  ADD COLUMN IF NOT EXISTS last_rewarded_level integer NOT NULL DEFAULT 0;

-- 2. record_game_play: allow up to level 300, mark milestone
CREATE OR REPLACE FUNCTION public.record_game_play(_game_name text, _score integer, _level_completed boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid := auth.uid();
  _row public.game_progress%ROWTYPE;
  _new_level integer; _new_best integer;
  _max_level integer := 300;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _game_name IS NULL OR length(_game_name) > 50 THEN RAISE EXCEPTION 'invalid_game'; END IF;
  IF _score IS NULL OR _score < 0 OR _score > 10000000 THEN _score := 0; END IF;
  INSERT INTO public.game_progress(user_id, game_name) VALUES (_user, _game_name)
    ON CONFLICT (user_id, game_name) DO NOTHING;
  SELECT * INTO _row FROM public.game_progress WHERE user_id = _user AND game_name = _game_name FOR UPDATE;
  _new_level := _row.level;
  IF _level_completed AND _row.level < _max_level THEN _new_level := _row.level + 1; END IF;
  _new_best := GREATEST(_row.best_score, _score);
  UPDATE public.game_progress
    SET level = _new_level, best_score = _new_best, total_plays = _row.total_plays + 1,
        last_played_at = now(), updated_at = now()
    WHERE user_id = _user AND game_name = _game_name;
  RETURN jsonb_build_object(
    'level', _new_level,
    'best_score', _new_best,
    'total_plays', _row.total_plays + 1,
    'reached_max', _new_level >= _max_level,
    'reward_milestone', (_new_level > _row.last_rewarded_level AND _new_level % 10 = 0)
  );
END; $function$;

-- 3. claim_game_reward: require milestone (level%10==0 and not yet claimed)
CREATE OR REPLACE FUNCTION public.claim_game_reward(_game_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _cap_tenths integer := 30;
  _used integer; _remaining integer;
  _options integer[] := ARRAY[2, 5, 10];
  _reward integer; _new_tenths integer; _whole integer;
  _new_balance integer; _new_fraction integer;
  _level integer; _last_rewarded integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _game_name IS NULL OR length(_game_name) > 50 THEN RAISE EXCEPTION 'invalid_game'; END IF;

  SELECT level, last_rewarded_level INTO _level, _last_rewarded
    FROM public.game_progress
    WHERE user_id = _user AND game_name = _game_name FOR UPDATE;

  IF _level IS NULL OR _level < 10 OR _level % 10 <> 0 OR _level <= COALESCE(_last_rewarded, 0) THEN
    RETURN jsonb_build_object(
      'status','level_required',
      'required_level', CASE WHEN _level IS NULL THEN 10 ELSE ((_level / 10) + 1) * 10 END,
      'current_level', COALESCE(_level, 0)
    );
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
  UPDATE public.game_progress SET last_rewarded_level = _level
    WHERE user_id = _user AND game_name = _game_name;

  UPDATE public.profiles SET game_coin_tenths = game_coin_tenths + _reward, updated_at = now()
    WHERE id = _user RETURNING game_coin_tenths INTO _new_tenths;
  _whole := _new_tenths / 10;
  IF _whole > 0 THEN
    UPDATE public.profiles SET coin_balance = coin_balance + _whole,
      game_coin_tenths = game_coin_tenths - (_whole * 10), updated_at = now()
      WHERE id = _user RETURNING coin_balance, game_coin_tenths INTO _new_balance, _new_fraction;
    INSERT INTO public.transactions(user_id, order_id, amount_idr, coin_amount, bonus_coin, status, tx_type, paid_at, meta)
    VALUES (_user, 'GAME-' || gen_random_uuid()::text, 0, _whole, 0, 'success', 'game_reward', now(),
            jsonb_build_object('game', _game_name, 'tenths', _reward, 'label', 'Mini Game Reward', 'level', _level));
  ELSE
    SELECT coin_balance, game_coin_tenths INTO _new_balance, _new_fraction FROM public.profiles WHERE id = _user;
  END IF;
  RETURN jsonb_build_object('status','success','reward_tenths',_reward,
    'used_tenths',COALESCE(_used,0)+_reward,'remaining_tenths',_remaining-_reward,
    'cap_tenths',_cap_tenths,'coin_balance',_new_balance,'fraction_tenths',_new_fraction,
    'level', _level);
END; $function$;

-- 4. Favorites triggers: keep stories.favorite_count in sync + notify author
CREATE OR REPLACE FUNCTION public.favorites_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _author uuid;
  _title text;
  _slug text;
  _fav_username text;
BEGIN
  UPDATE public.stories
    SET favorite_count = favorite_count + 1
    WHERE id = NEW.story_id
    RETURNING author_id, title, slug INTO _author, _title, _slug;

  IF _author IS NOT NULL AND _author <> NEW.user_id THEN
    SELECT username INTO _fav_username FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      _author,
      'favorite',
      'Cerita kamu ditambahkan ke favorit',
      COALESCE('@' || _fav_username, 'Seseorang') || ' menambahkan "' || _title || '" ke favorit.',
      '/story/' || _slug
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.favorites_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.stories
    SET favorite_count = GREATEST(0, favorite_count - 1)
    WHERE id = OLD.story_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_favorites_insert ON public.favorites;
CREATE TRIGGER trg_favorites_insert
  AFTER INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.favorites_after_insert();

DROP TRIGGER IF EXISTS trg_favorites_delete ON public.favorites;
CREATE TRIGGER trg_favorites_delete
  AFTER DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.favorites_after_delete();

-- 5. Backfill favorite_count to match current rows
UPDATE public.stories s SET favorite_count = COALESCE(c.cnt, 0)
FROM (
  SELECT story_id, COUNT(*)::int AS cnt FROM public.favorites GROUP BY story_id
) c WHERE c.story_id = s.id;
