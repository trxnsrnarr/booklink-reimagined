# Plan: Mini-Games Total Rework + Favorites Fix

## Scope
Two independent systems on the existing Booklink project. No restart, only targeted changes.

---

## Part A — Mini-Games System

### A1. Routing fix
Current `src/routes/mini-games.tsx` already links to `/mini-games/$gameId` with slugs `flappy | memory | reflex | tap | puzzle`. The dynamic route `src/routes/mini-games.$gameId.tsx` exists but likely doesn't render real gameplay. **Action:** rewrite `mini-games.$gameId.tsx` to be a real full-page game host that switches on `gameId` and mounts the proper game component. Keep existing slugs (no need to rename to `flappy-bookbird` — current slugs work and match the hub links).

### A2. New playable games (full-page, canvas / DOM-based)
Rewrite the 5 game components as real playable mini-games:
- **Flappy BookBird** — canvas physics: gravity, flap on tap/space, scrolling random pipes, collision, score, restart, pause.
- **Memory Match** — grid of cards, flip, match, timer.
- **Reflex Strike** — tap targets that appear/disappear with shrinking window.
- **Tap Frenzy** — count taps in time window per level.
- **Number Rush** — tap 1..N in order, N grows with level.

All games:
- Responsive canvas / grid (mobile touch + desktop click/keyboard).
- Local game loop using `requestAnimationFrame`.
- Game over screen + restart + pause.
- Reports score + level-completed to server via existing `recordGamePlay` / `claimGameReward` server fns.

### A3. Level system → 300
- Bump `MAX_LEVEL` from 10 → **300** in `shared.tsx`.
- Update SQL function `record_game_play` to allow `level` up to 300 and tune difficulty progression based on `level`.
- Reward gate: only fire `claim_game_reward` when `level % 10 == 0` (every 10 levels), random `0.2 / 0.5 / 1` coin.
- Daily cap remains 3 coins (already implemented).

### A4. Reward + daily limit UI
- When `remaining_tenths <= 0` AND user clicks a game card → show animated modal: "Kamu sudah mencapai batas maksimal reward game hari ini (3 coin). Silakan kembali besok." User can still play (no reward) — but per user instruction we lock entry. **Decision:** block entry to game page (redirect back) when limit reached, show popup.
- Transaction history entry labeled "Mini Game Reward" — confirm/update SQL function to insert into `transactions` with that label.

### A5. DB migration
- Update `record_game_play`: support level cap 300, return current level.
- Update `claim_game_reward`: require `level % 10 == 0`, weighted random reward (0.2/0.5/1 = 2/5/10 tenths), enforce 30-tenth daily cap, insert transaction row `tx_type='game_reward'` with meta `{label: 'Mini Game Reward'}`.

---

## Part B — Favorites + Library

### B1. Favorite toggle fix
- `favorites` table exists with RLS (`user_id = auth.uid()`).
- `stories.favorite_count` exists but not auto-incremented. Add **DB triggers** on `favorites` INSERT/DELETE to update `stories.favorite_count`.
- Frontend on `/story/$slug`: optimistic toggle using `supabase.from('favorites').insert/delete`, then invalidate story query for fresh count.
- Add notification on favorite insert: trigger inserts notification row for `stories.author_id` ("Cerita kamu ditambahkan ke favorit").

### B2. Library/Favorites page
- `src/routes/library.tsx` already exists — review and make sure it lists user favorites (join `favorites` + `stories`) with cover/title/author/last-updated, "Continue reading" link, "Remove" button.
- Aesthetic: reuse `StoryCard` / horizontal card grid matching homepage.

---

## Technical Details

### Files to create
- `src/components/mini-games/FlappyGame.tsx`
- `src/components/mini-games/MemoryGame.tsx`
- `src/components/mini-games/ReflexGame.tsx`
- `src/components/mini-games/TapGame.tsx`
- `src/components/mini-games/PuzzleGame.tsx`
- `src/components/DailyLimitModal.tsx`

### Files to edit
- `src/components/mini-games/shared.tsx` — MAX_LEVEL=300, limit modal hook
- `src/routes/mini-games.$gameId.tsx` — full-page host that switches game
- `src/routes/mini-games.tsx` — block entry on limit, show popup
- `src/routes/story.$slug.tsx` — fix favorite toggle + count
- `src/routes/library.tsx` — favorites list polish
- `src/components/StoryCard.tsx` — wire favorite toggle if used

### DB migration
1. `ALTER FUNCTION record_game_play` — accept up to level 300, difficulty scaling
2. `ALTER FUNCTION claim_game_reward` — require `level % 10 == 0`, weighted random reward, transaction row
3. Trigger `favorites_after_insert` — increments `stories.favorite_count`, inserts notification for author
4. Trigger `favorites_after_delete` — decrements `stories.favorite_count`

### Out of scope (not requested or already exists)
- Realtime websocket sync (TanStack Query invalidation is sufficient per existing pattern).
- Visual asset regeneration for game thumbnails (existing images reused).
