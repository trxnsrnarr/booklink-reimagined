-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  coin_balance INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  vip_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  synopsis TEXT,
  cover_url TEXT,
  cover_gradient TEXT,
  genre TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published',
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  unlock_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  is_trending BOOLEAN NOT NULL DEFAULT false,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_select_published" ON public.stories FOR SELECT USING (status = 'published' OR author_id = auth.uid());
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "stories_update_own" ON public.stories FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE USING (author_id = auth.uid());
CREATE INDEX idx_stories_genre ON public.stories(genre);
CREATE INDEX idx_stories_created ON public.stories(created_at DESC);

CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  coin_price INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  reader_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapters_select_published" ON public.chapters FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND (s.status = 'published' OR s.author_id = auth.uid()))
);
CREATE POLICY "chapters_modify_author" ON public.chapters FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid())
);
CREATE INDEX idx_chapters_story ON public.chapters(story_id, order_index);

CREATE TABLE public.libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "libraries_owner_all" ON public.libraries FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(library_id, story_id)
);
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_items_owner_all" ON public.library_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.libraries l WHERE l.id = library_id AND l.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.libraries l WHERE l.id = library_id AND l.user_id = auth.uid())
);

CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, story_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_owner_all" ON public.favorites FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_select_all" ON public.followers FOR SELECT USING (true);
CREATE POLICY "followers_owner_modify" ON public.followers FOR ALL USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_username TEXT;
BEGIN
  new_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) THEN
    new_username := new_username || '_' || substr(NEW.id::text, 1, 6);
  END IF;
  INSERT INTO public.profiles (id, username, display_name, coin_balance) VALUES (NEW.id, new_username, new_username, 100);
  INSERT INTO public.libraries (user_id, name, is_default) VALUES (NEW.id, 'Read Later', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER stories_touch BEFORE UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_owner_all" ON public.notifications FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  amount_idr INTEGER NOT NULL CHECK (amount_idr > 0),
  coin_amount INTEGER NOT NULL,
  bonus_coin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','expired','cancel')),
  payment_type TEXT,
  snap_token TEXT,
  midtrans_response JSONB,
  paid_at TIMESTAMPTZ,
  tx_type TEXT NOT NULL DEFAULT 'topup',
  ref_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (coin_amount >= 0)
);
CREATE INDEX idx_transactions_user ON public.transactions(user_id, created_at DESC);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_owner_select ON public.transactions FOR SELECT USING (user_id = auth.uid());
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.coin_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coin_amount INTEGER NOT NULL CHECK (coin_amount > 0),
  bonus_coin INTEGER NOT NULL DEFAULT 0,
  price_idr INTEGER NOT NULL CHECK (price_idr > 0),
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_packages_select_all ON public.coin_packages FOR SELECT USING (is_active);

INSERT INTO public.coin_packages (name, coin_amount, bonus_coin, price_idr, is_popular, sort_order) VALUES
  ('Starter', 50, 0, 10000, false, 1),
  ('Reader', 120, 10, 20000, false, 2),
  ('Popular', 320, 40, 50000, true, 3),
  ('Power', 700, 100, 100000, false, 4),
  ('Mega', 1600, 300, 200000, false, 5);

CREATE OR REPLACE FUNCTION public.create_pending_transaction(
  _user_id UUID, _order_id TEXT, _amount_idr INTEGER, _coin_amount INTEGER, _bonus_coin INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.transactions (user_id, order_id, amount_idr, coin_amount, bonus_coin, status)
  VALUES (_user_id, _order_id, _amount_idr, _coin_amount, _bonus_coin, 'pending')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY user_roles_self_select ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_vip(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user_id AND vip_until IS NOT NULL AND vip_until > now());
$$;
REVOKE EXECUTE ON FUNCTION public.is_vip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vip(uuid) TO authenticated;

CREATE TABLE public.chapter_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  coin_paid INTEGER NOT NULL DEFAULT 0,
  author_share INTEGER NOT NULL DEFAULT 0,
  platform_share INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);
CREATE INDEX idx_chapter_unlocks_user ON public.chapter_unlocks(user_id);
CREATE INDEX idx_chapter_unlocks_author ON public.chapter_unlocks(author_id, created_at DESC);
ALTER TABLE public.chapter_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chapter_unlocks_self_select ON public.chapter_unlocks FOR SELECT USING (user_id = auth.uid() OR author_id = auth.uid());

CREATE TABLE public.author_earnings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_earned INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  withdrawn INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.author_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY author_earnings_self ON public.author_earnings FOR SELECT USING (user_id = auth.uid());

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_coin INTEGER NOT NULL CHECK (amount_coin > 0),
  method TEXT NOT NULL CHECK (method IN ('dana','ovo','gopay','bank')),
  account_info JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id, created_at DESC);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY withdrawals_self_select ON public.withdrawals FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_withdrawals_updated BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.theme_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, theme_id)
);
ALTER TABLE public.theme_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY theme_purchases_self ON public.theme_purchases FOR SELECT USING (user_id = auth.uid());

CREATE TABLE public.ad_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_date DATE NOT NULL DEFAULT (now()::date),
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, reward_date)
);
ALTER TABLE public.ad_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_rewards_self ON public.ad_rewards FOR SELECT USING (user_id = auth.uid());

CREATE TABLE public.story_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_likes_self ON public.story_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.unlock_chapter(_chapter_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _chapter public.chapters;
  _story public.stories;
  _price integer;
  _balance integer;
  _is_vip boolean;
  _first_vip boolean;
  _vip_bonus integer := 50;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _chapter FROM public.chapters WHERE id = _chapter_id;
  IF _chapter IS NULL THEN RAISE EXCEPTION 'chapter_not_found'; END IF;
  SELECT * INTO _story FROM public.stories WHERE id = _chapter.story_id;
  IF _story IS NULL THEN RAISE EXCEPTION 'story_not_found'; END IF;
  IF _story.author_id = _user THEN RETURN jsonb_build_object('status','author_owns'); END IF;
  _is_vip := public.is_vip(_user);
  IF _story.is_vip THEN
    IF NOT _is_vip THEN RETURN jsonb_build_object('status','vip_required'); END IF;
    SELECT NOT EXISTS(SELECT 1 FROM public.chapter_unlocks WHERE user_id = _user AND story_id = _story.id) INTO _first_vip;
    INSERT INTO public.chapter_unlocks(user_id, chapter_id, story_id, author_id, coin_paid, author_share, platform_share)
    VALUES (_user, _chapter_id, _story.id, _story.author_id, 0, CASE WHEN _first_vip THEN _vip_bonus ELSE 0 END, 0)
    ON CONFLICT DO NOTHING;
    IF _first_vip THEN
      INSERT INTO public.author_earnings(user_id, total_earned, balance)
      VALUES (_story.author_id, _vip_bonus, _vip_bonus)
      ON CONFLICT (user_id) DO UPDATE SET
        total_earned = author_earnings.total_earned + EXCLUDED.total_earned,
        balance = author_earnings.balance + EXCLUDED.balance,
        updated_at = now();
      UPDATE public.stories SET unlock_count = unlock_count + 1 WHERE id = _story.id;
      INSERT INTO public.notifications(user_id,type,title,body,link)
      VALUES (_story.author_id, 'earning', 'Pembaca VIP baru!', 'Kamu mendapat '||_vip_bonus||' coin dari pembaca VIP cerita "'||_story.title||'"', '/story/'||_story.slug);
    END IF;
    RETURN jsonb_build_object('status','vip_unlocked','first_vip', _first_vip);
  END IF;
  IF NOT _chapter.is_premium THEN RETURN jsonb_build_object('status','free'); END IF;
  IF EXISTS(SELECT 1 FROM public.chapter_unlocks WHERE user_id=_user AND chapter_id=_chapter_id) THEN
    RETURN jsonb_build_object('status','already_unlocked');
  END IF;
  IF _is_vip THEN
    INSERT INTO public.chapter_unlocks(user_id, chapter_id, story_id, author_id, coin_paid, author_share, platform_share)
    VALUES (_user, _chapter_id, _story.id, _story.author_id, 0, 0, 0)
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','vip_unlocked');
  END IF;
  _price := COALESCE(NULLIF(_chapter.coin_price,0), 10);
  SELECT coin_balance INTO _balance FROM public.profiles WHERE id = _user FOR UPDATE;
  IF _balance < _price THEN RETURN jsonb_build_object('status','insufficient','needed',_price,'balance',_balance); END IF;
  UPDATE public.profiles SET coin_balance = coin_balance - _price WHERE id = _user;
  INSERT INTO public.chapter_unlocks(user_id, chapter_id, story_id, author_id, coin_paid, author_share, platform_share)
  VALUES (_user, _chapter_id, _story.id, _story.author_id, _price, _price, 0);
  INSERT INTO public.author_earnings(user_id, total_earned, balance)
  VALUES (_story.author_id, _price, _price)
  ON CONFLICT (user_id) DO UPDATE SET
    total_earned = author_earnings.total_earned + EXCLUDED.total_earned,
    balance = author_earnings.balance + EXCLUDED.balance,
    updated_at = now();
  UPDATE public.stories SET unlock_count = unlock_count + 1 WHERE id = _story.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
  VALUES (_story.author_id, 'earning', 'Chapter dibeli!', 'Kamu mendapat '||_price||' coin dari "'||_chapter.title||'"', '/story/'||_story.slug);
  RETURN jsonb_build_object('status','success','paid',_price,'author_share',_price);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unlock_chapter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_chapter(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_chapter_view(_chapter_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chapters SET reader_count = reader_count + 1 WHERE id = _chapter_id;
  UPDATE public.stories SET views = views + 1 WHERE id = (SELECT story_id FROM public.chapters WHERE id = _chapter_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_chapter_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_chapter_view(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.toggle_story_like(_story_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid := auth.uid(); _exists boolean;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.story_likes WHERE user_id=_user AND story_id=_story_id) INTO _exists;
  IF _exists THEN
    DELETE FROM public.story_likes WHERE user_id=_user AND story_id=_story_id;
    UPDATE public.stories SET likes_count = GREATEST(likes_count-1,0) WHERE id=_story_id;
    RETURN jsonb_build_object('liked', false);
  ELSE
    INSERT INTO public.story_likes(user_id, story_id) VALUES (_user, _story_id);
    UPDATE public.stories SET likes_count = likes_count+1 WHERE id=_story_id;
    RETURN jsonb_build_object('liked', true);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_story_like(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_story_like(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount_coin integer, _method text, _account_info jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid := auth.uid(); _bal integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT balance INTO _bal FROM public.author_earnings WHERE user_id=_user FOR UPDATE;
  IF COALESCE(_bal,0) < _amount_coin THEN RETURN jsonb_build_object('status','insufficient'); END IF;
  UPDATE public.author_earnings SET balance = balance - _amount_coin, updated_at = now() WHERE user_id=_user;
  INSERT INTO public.withdrawals(user_id, amount_coin, method, account_info, status)
  VALUES (_user, _amount_coin, _method, _account_info, 'pending');
  RETURN jsonb_build_object('status','requested');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_withdrawal(_id uuid, _status text, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id=_id FOR UPDATE;
  IF _w IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.withdrawals SET status=_status, note=_note, updated_at=now() WHERE id=_id;
  IF _status = 'rejected' AND _w.status = 'pending' THEN
    UPDATE public.author_earnings SET balance = balance + _w.amount_coin, updated_at = now() WHERE user_id=_w.user_id;
  ELSIF _status = 'paid' THEN
    UPDATE public.author_earnings SET withdrawn = withdrawn + _w.amount_coin, updated_at = now() WHERE user_id=_w.user_id;
  END IF;
  RETURN jsonb_build_object('status', _status);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_theme(_theme_id text, _price integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid := auth.uid(); _bal integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF EXISTS(SELECT 1 FROM public.theme_purchases WHERE user_id=_user AND theme_id=_theme_id) THEN
    RETURN jsonb_build_object('status','already_owned');
  END IF;
  SELECT coin_balance INTO _bal FROM public.profiles WHERE id=_user FOR UPDATE;
  IF _bal < _price THEN RETURN jsonb_build_object('status','insufficient'); END IF;
  UPDATE public.profiles SET coin_balance = coin_balance - _price WHERE id=_user;
  INSERT INTO public.theme_purchases(user_id, theme_id, price) VALUES (_user, _theme_id, _price);
  RETURN jsonb_build_object('status','purchased');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_theme(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_theme(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_ad_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid := auth.uid(); _today date := now()::date; _cnt integer; _limit integer := 5; _coin integer := 5;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  INSERT INTO public.ad_rewards(user_id, reward_date, count) VALUES (_user, _today, 0)
    ON CONFLICT (user_id, reward_date) DO NOTHING;
  SELECT count INTO _cnt FROM public.ad_rewards WHERE user_id=_user AND reward_date=_today FOR UPDATE;
  IF _cnt >= _limit THEN RETURN jsonb_build_object('status','limit_reached','remaining',0); END IF;
  UPDATE public.ad_rewards SET count = count + 1 WHERE user_id=_user AND reward_date=_today;
  UPDATE public.profiles SET coin_balance = coin_balance + _coin WHERE id=_user;
  RETURN jsonb_build_object('status','success','coin',_coin,'remaining', _limit - (_cnt+1));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_ad_reward() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_pending_transaction_v2(
  _user_id uuid, _order_id text, _amount_idr integer,
  _coin_amount integer, _bonus_coin integer,
  _tx_type text, _ref_id uuid, _meta jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.transactions(user_id, order_id, amount_idr, coin_amount, bonus_coin, status, tx_type, ref_id, meta)
  VALUES (_user_id, _order_id, _amount_idr, _coin_amount, _bonus_coin, 'pending', _tx_type, _ref_id, _meta)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  story_id UUID,
  chapter_id UUID,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  likes_count INTEGER NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (story_id IS NOT NULL OR chapter_id IS NOT NULL)
);
CREATE INDEX idx_comments_story ON public.comments(story_id, created_at DESC);
CREATE INDEX idx_comments_chapter ON public.comments(chapter_id, created_at DESC);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.comment_likes (
  user_id UUID NOT NULL,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_select_all" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_self" ON public.comment_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_comment_like(_comment_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user UUID := auth.uid(); _exists BOOLEAN;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.comment_likes WHERE user_id=_user AND comment_id=_comment_id) INTO _exists;
  IF _exists THEN
    DELETE FROM public.comment_likes WHERE user_id=_user AND comment_id=_comment_id;
    UPDATE public.comments SET likes_count = GREATEST(likes_count-1,0) WHERE id=_comment_id;
    RETURN jsonb_build_object('liked', false);
  ELSE
    INSERT INTO public.comment_likes(user_id, comment_id) VALUES (_user, _comment_id);
    UPDATE public.comments SET likes_count = likes_count+1 WHERE id=_comment_id;
    RETURN jsonb_build_object('liked', true);
  END IF;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.followers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.library_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('covers', 'covers', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('chapter-images', 'chapter-images', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read images" ON storage.objects FOR SELECT
  USING (bucket_id IN ('covers','chapter-images','avatars'));
CREATE POLICY "Users upload own images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('covers','chapter-images','avatars') AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('covers','chapter-images','avatars') AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('covers','chapter-images','avatars') AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS vip_payment_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS chapter_payment_status text NOT NULL DEFAULT 'none';

CREATE OR REPLACE FUNCTION public.lock_chapter_price()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_premium THEN
    NEW.coin_price := 10;
  ELSE
    NEW.coin_price := 0;
    NEW.chapter_payment_status := 'none';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_chapter_price BEFORE INSERT OR UPDATE ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.lock_chapter_price();

CREATE OR REPLACE FUNCTION public.guard_story_vip_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_vip AND NEW.status='published' AND COALESCE(NEW.vip_payment_status,'none') <> 'success' THEN
    RAISE EXCEPTION 'vip_payment_required' USING HINT='Bayar Rp 15.000 untuk publish cerita VIP.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_story_vip BEFORE INSERT OR UPDATE ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.guard_story_vip_publish();

CREATE OR REPLACE FUNCTION public.guard_chapter_paid()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_premium AND COALESCE(NEW.chapter_payment_status,'none') <> 'success' THEN
    RAISE EXCEPTION 'chapter_payment_required' USING HINT='Bayar Rp 1.000 untuk mengaktifkan chapter berbayar.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_chapter_paid BEFORE INSERT OR UPDATE ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.guard_chapter_paid();

CREATE TABLE IF NOT EXISTS public.chapter_likes (
  user_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  story_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chapter_id)
);
ALTER TABLE public.chapter_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY chapter_likes_select_all ON public.chapter_likes FOR SELECT USING (true);
CREATE POLICY chapter_likes_self ON public.chapter_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_chapter_like(_chapter_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _user uuid := auth.uid(); _exists boolean; _story uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT story_id INTO _story FROM public.chapters WHERE id=_chapter_id;
  IF _story IS NULL THEN RAISE EXCEPTION 'chapter_not_found'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.chapter_likes WHERE user_id=_user AND chapter_id=_chapter_id) INTO _exists;
  IF _exists THEN
    DELETE FROM public.chapter_likes WHERE user_id=_user AND chapter_id=_chapter_id;
    UPDATE public.stories SET likes_count = GREATEST(likes_count-1,0) WHERE id=_story;
    RETURN jsonb_build_object('liked', false);
  ELSE
    INSERT INTO public.chapter_likes(user_id, chapter_id, story_id) VALUES (_user, _chapter_id, _story);
    UPDATE public.stories SET likes_count = likes_count+1 WHERE id=_story;
    RETURN jsonb_build_object('liked', true);
  END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

CREATE OR REPLACE FUNCTION public.fulfill_transaction(_order_id text, _status text, _payment_type text, _midtrans jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tx public.transactions;
  _months integer;
  _base timestamptz;
  _final_status text := COALESCE(NULLIF(_status, ''), 'pending');
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE order_id = _order_id FOR UPDATE;
  IF _tx IS NULL THEN
    RAISE EXCEPTION 'tx_not_found';
  END IF;

  IF _tx.status = 'success' THEN
    UPDATE public.transactions
      SET payment_type = COALESCE(_payment_type, payment_type),
          midtrans_response = COALESCE(_midtrans, midtrans_response),
          updated_at = now()
      WHERE id = _tx.id;
    RETURN jsonb_build_object('status','already','tx_type',_tx.tx_type);
  END IF;

  IF _final_status <> 'success' THEN
    UPDATE public.transactions
      SET status = _final_status,
          payment_type = COALESCE(_payment_type, payment_type),
          midtrans_response = COALESCE(_midtrans, midtrans_response),
          updated_at = now()
      WHERE id = _tx.id;
    RETURN jsonb_build_object('status', _final_status, 'tx_type', _tx.tx_type);
  END IF;

  UPDATE public.transactions
    SET status = 'success',
        payment_type = _payment_type,
        midtrans_response = _midtrans,
        paid_at = now(),
        updated_at = now()
    WHERE id = _tx.id;

  IF _tx.tx_type = 'topup' THEN
    UPDATE public.profiles
      SET coin_balance = coin_balance + COALESCE(_tx.coin_amount,0) + COALESCE(_tx.bonus_coin,0),
          updated_at = now()
      WHERE id = _tx.user_id;
    INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (_tx.user_id,'topup','Top up sukses',(COALESCE(_tx.coin_amount,0)+COALESCE(_tx.bonus_coin,0))||' coin masuk ke saldo','/wallet');

  ELSIF _tx.tx_type = 'vip_sub' THEN
    _months := COALESCE((_tx.meta->>'months')::int, 1);
    SELECT GREATEST(COALESCE(vip_until, now()), now()) INTO _base FROM public.profiles WHERE id = _tx.user_id;
    UPDATE public.profiles
      SET vip_until = _base + (_months || ' months')::interval,
          coin_balance = coin_balance + COALESCE(_tx.coin_amount,0) + COALESCE(_tx.bonus_coin,0),
          updated_at = now()
      WHERE id = _tx.user_id;
    INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (_tx.user_id,'vip','VIP Aktif',('Keanggotaan VIP kamu aktif selama '||_months||' bulan.'),'/wallet');

  ELSIF _tx.tx_type = 'vip_story' THEN
    IF _tx.ref_id IS NOT NULL THEN
      UPDATE public.stories
        SET vip_payment_status='success', is_vip=true, status='published', updated_at=now()
        WHERE id=_tx.ref_id AND author_id=_tx.user_id;
      INSERT INTO public.notifications(user_id,type,title,body,link)
      VALUES (_tx.user_id,'system','Cerita VIP terbit','Pembayaran berhasil. Cerita kamu otomatis terbit sebagai VIP.','/my-stories');
    END IF;

  ELSIF _tx.tx_type = 'paid_chapter' THEN
    IF _tx.ref_id IS NOT NULL THEN
      UPDATE public.chapters SET chapter_payment_status='success', is_premium=true
      WHERE id=_tx.ref_id AND EXISTS(SELECT 1 FROM public.stories s WHERE s.id=chapters.story_id AND s.author_id=_tx.user_id);
      UPDATE public.stories s SET status='published', updated_at=now()
      WHERE s.author_id=_tx.user_id AND s.status <> 'published'
        AND s.id = (SELECT story_id FROM public.chapters WHERE id=_tx.ref_id);
      INSERT INTO public.notifications(user_id,type,title,body,link)
      VALUES (_tx.user_id,'system','Chapter berbayar aktif','Pembayaran berhasil. Chapter kamu aktif dan otomatis terbit.','/my-stories');
    END IF;
  END IF;

  RETURN jsonb_build_object('status','ok','tx_type',_tx.tx_type);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fulfill_transaction(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_transaction(text, text, text, jsonb) TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='chapter_likes_user_chapter_uniq') THEN
    CREATE UNIQUE INDEX chapter_likes_user_chapter_uniq ON public.chapter_likes(user_id, chapter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='story_likes_user_story_uniq') THEN
    CREATE UNIQUE INDEX story_likes_user_story_uniq ON public.story_likes(user_id, story_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='comment_likes_user_comment_uniq') THEN
    CREATE UNIQUE INDEX comment_likes_user_comment_uniq ON public.comment_likes(user_id, comment_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid NOT NULL,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user1_id < user2_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_uniq ON public.conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS conversations_user1_idx ON public.conversations(user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user2_idx ON public.conversations(user2_id, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_participant_select ON public.conversations;
CREATE POLICY conversations_participant_select ON public.conversations
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS conversations_participant_insert ON public.conversations;
CREATE POLICY conversations_participant_insert ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages(conversation_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_participant_select ON public.messages;
CREATE POLICY messages_participant_select ON public.messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())));
DROP POLICY IF EXISTS messages_sender_insert ON public.messages;
CREATE POLICY messages_sender_insert ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())));
DROP POLICY IF EXISTS messages_recipient_update ON public.messages;
CREATE POLICY messages_recipient_update ON public.messages
  FOR UPDATE USING (sender_id <> auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv public.conversations; _recipient uuid; _sender_name text;
BEGIN
  SELECT * INTO _conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF _conv IS NULL THEN RETURN NEW; END IF;
  _recipient := CASE WHEN _conv.user1_id = NEW.sender_id THEN _conv.user2_id ELSE _conv.user1_id END;
  UPDATE public.conversations SET last_message = LEFT(NEW.content, 200), last_message_at = NEW.created_at, last_sender_id = NEW.sender_id WHERE id = NEW.conversation_id;
  SELECT COALESCE(display_name, username) INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_recipient, 'chat', 'Pesan baru dari ' || COALESCE(_sender_name, 'seseorang'), LEFT(NEW.content, 140), '/chat/' || NEW.conversation_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_after_insert ON public.messages;
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

CREATE OR REPLACE FUNCTION public.handle_comment_reply_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _parent public.comments; _replier_name text; _chapter record; _story_title text; _slug text; _link text;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _parent FROM public.comments WHERE id = NEW.parent_id;
  IF _parent IS NULL OR _parent.user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username) INTO _replier_name FROM public.profiles WHERE id = NEW.user_id;
  IF NEW.chapter_id IS NOT NULL THEN
    SELECT c.title AS chapter_title, c.order_index, s.title AS story_title INTO _chapter
      FROM public.chapters c JOIN public.stories s ON s.id = c.story_id WHERE c.id = NEW.chapter_id;
    _link := '/read/' || NEW.chapter_id::text || '#comment-' || NEW.id::text;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (_parent.user_id, 'reply', 'Balasan baru di ' || COALESCE(_chapter.story_title, 'cerita'),
            COALESCE(_replier_name, 'Seseorang') || ' membalas komentarmu di chapter "' || COALESCE(_chapter.chapter_title, '') || '"', _link);
  ELSIF NEW.story_id IS NOT NULL THEN
    SELECT s.title, s.slug INTO _story_title, _slug FROM public.stories s WHERE s.id = NEW.story_id;
    _link := '/story/' || _slug || '#comment-' || NEW.id::text;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (_parent.user_id, 'reply', 'Balasan baru di ' || COALESCE(_story_title, 'cerita'),
            COALESCE(_replier_name, 'Seseorang') || ' membalas komentarmu', _link);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS comments_after_insert_reply_notify ON public.comments;
CREATE TRIGGER comments_after_insert_reply_notify AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.handle_comment_reply_notification();

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _a uuid; _b uuid; _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _other = _me THEN RAISE EXCEPTION 'cannot_chat_self'; END IF;
  IF _me < _other THEN _a := _me; _b := _other; ELSE _a := _other; _b := _me; END IF;
  SELECT id INTO _id FROM public.conversations WHERE user1_id = _a AND user2_id = _b;
  IF _id IS NULL THEN
    INSERT INTO public.conversations(user1_id, user2_id) VALUES (_a, _b) RETURNING id INTO _id;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _count integer;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = _conv AND (_me IN (user1_id, user2_id))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.messages SET read_at = now() WHERE conversation_id = _conv AND sender_id <> _me AND read_at IS NULL;
  GET DIAGNOSTICS _count = ROW_COUNT;
  UPDATE public.notifications SET is_read = true WHERE user_id = _me AND type = 'chat' AND link = '/chat/' || _conv::text AND is_read = false;
  RETURN _count;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversations') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reading_progress (
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reading_progress_self ON public.reading_progress;
CREATE POLICY reading_progress_self ON public.reading_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_rp_user_updated ON public.reading_progress(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.record_reading_progress(_chapter_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _user uuid := auth.uid(); _story uuid;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  SELECT story_id INTO _story FROM public.chapters WHERE id = _chapter_id;
  IF _story IS NULL THEN RETURN; END IF;
  INSERT INTO public.reading_progress(user_id, story_id, chapter_id, updated_at)
  VALUES (_user, _story, _chapter_id, now())
  ON CONFLICT (user_id, story_id)
  DO UPDATE SET chapter_id = EXCLUDED.chapter_id, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_story_comments_count(_story uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.stories s
  SET comments_count = (
    SELECT COUNT(*) FROM public.comments c
    WHERE c.is_deleted = false AND (
      c.story_id = _story
      OR c.chapter_id IN (SELECT id FROM public.chapters WHERE story_id = _story)
    )
  )
  WHERE s.id = _story;
$$;

CREATE OR REPLACE FUNCTION public.tg_comments_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _sid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _sid := COALESCE(OLD.story_id, (SELECT story_id FROM public.chapters WHERE id = OLD.chapter_id));
  ELSE
    _sid := COALESCE(NEW.story_id, (SELECT story_id FROM public.chapters WHERE id = NEW.chapter_id));
  END IF;
  IF _sid IS NOT NULL THEN
    PERFORM public.recompute_story_comments_count(_sid);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS comments_count_aiud ON public.comments;
CREATE TRIGGER comments_count_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.tg_comments_count();

UPDATE public.stories s SET comments_count = (
  SELECT COUNT(*) FROM public.comments c
  WHERE c.is_deleted = false AND (
    c.story_id = s.id
    OR c.chapter_id IN (SELECT id FROM public.chapters WHERE story_id = s.id)
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_progress;