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
  _used integer;
  _remaining integer;
  _options integer[] := ARRAY[2, 5, 10];
  _reward integer;
  _new_tenths integer;
  _whole integer;
  _new_balance integer;
  _new_fraction integer;
  _level integer;
  _last_rewarded integer;
  _tx_order_id text;
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
  ELSE
    SELECT coin_balance, game_coin_tenths INTO _new_balance, _new_fraction FROM public.profiles WHERE id = _user;
  END IF;

  _tx_order_id := 'GAME-' || gen_random_uuid()::text;
  INSERT INTO public.transactions(user_id, order_id, amount_idr, coin_amount, bonus_coin, status, tx_type, paid_at, meta, payment_type)
  VALUES (
    _user,
    _tx_order_id,
    0,
    0,
    0,
    'success',
    'game_reward',
    now(),
    jsonb_build_object(
      'game', _game_name,
      'tenths', _reward,
      'label', 'Mini Game Reward',
      'level', _level,
      'display_coin', (_reward::numeric / 10),
      'credited_whole_coin', _whole
    ),
    'Mini Game Reward'
  );

  RETURN jsonb_build_object(
    'status','success',
    'reward_tenths',_reward,
    'used_tenths',COALESCE(_used,0)+_reward,
    'remaining_tenths',_remaining-_reward,
    'cap_tenths',_cap_tenths,
    'coin_balance',_new_balance,
    'fraction_tenths',_new_fraction,
    'level', _level,
    'order_id', _tx_order_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_game_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_game_reward(text) TO authenticated;