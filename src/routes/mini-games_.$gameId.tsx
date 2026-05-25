import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Coins, Crosshair, Gamepad2, Play, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGameProgress, getGameStats } from "@/lib/games.functions";
import { BOOKLINK_BG, BOOKLINK_GOLD, fmtCoins, MAX_LEVEL } from "@/components/mini-games/shared";
import { useAuth } from "@/hooks/use-auth";
import flappyThumb from "@/assets/games/flappy.jpg";
import memoryThumb from "@/assets/games/memory.jpg";
import reflexThumb from "@/assets/games/reflex.jpg";
import tapThumb from "@/assets/games/tap.jpg";
import puzzleThumb from "@/assets/games/puzzle.jpg";

export const Route = createFileRoute("/mini-games_/$gameId")({
  component: MiniGameLayout,
});

function MiniGameLayout() {
  const { gameId } = Route.useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const canonical = LEGACY_GAME_SLUGS[gameId] ?? gameId;

  useEffect(() => {
    if (location.pathname.endsWith("/play")) return;
    if (canonical !== gameId) {
      console.info(`[BookLink Arcade] legacy detail route normalized: /mini-games/${gameId} -> /mini-games/${canonical}`);
      navigate({ to: "/mini-games/$gameId", params: { gameId: canonical }, replace: true });
    }
  }, [canonical, gameId, location.pathname, navigate]);

  if (location.pathname.endsWith("/play")) return <Outlet />;
  return <GameDetail gameId={canonical} />;
}

function GameDetail({ gameId }: { gameId: string }) {
  const game = GAME_DETAILS[gameId];
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchStats = useServerFn(getGameStats);
  const fetchProgress = useServerFn(getGameProgress);
  const [limitOpen, setLimitOpen] = useState(false);
  const stats = useQuery({ queryKey: ["game-stats"], queryFn: () => fetchStats(), enabled: !!user });
  const progress = useQuery({ queryKey: ["game-progress-all"], queryFn: () => fetchProgress(), enabled: !!user });
  const progressRow = useMemo(() => (progress.data ?? []).find((p) => p.game_name === game?.id), [progress.data, game?.id]);

  if (!game) {
    return <div className="min-h-screen grid place-items-center" style={{ background: BOOKLINK_BG }}><Link to="/mini-games" className="text-white">Game tidak ditemukan</Link></div>;
  }

  const level = progressRow?.level ?? 1;
  const best = progressRow?.best_score ?? 0;
  const plays = progressRow?.total_plays ?? 0;
  const nextReward = Math.min(MAX_LEVEL, (Math.floor(level / 10) + 1) * 10);
  const rewardProgress = ((level % 10) / 10) * 100;
  const limitReached = !!user && (stats.data?.remaining_tenths ?? 30) <= 0;
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else navigate({ to: "/mini-games" });
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: game.bg }}>
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl" style={{ background: "oklch(0.82 0.13 80 / 0.35)" }} />
        <div className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full blur-3xl" style={{ background: "oklch(0.62 0.13 50 / 0.32)" }} />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 text-[oklch(0.97_0.02_75)]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button onClick={goBack} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/18">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-wider backdrop-blur"><ShieldCheck className="h-4 w-4" /> Backend validated</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[2rem] bg-[oklch(0.13_0.02_45_/_0.78)] shadow-2xl ring-1 ring-[oklch(0.82_0.13_80_/_0.28)] backdrop-blur">
            <div className="relative aspect-[16/10] overflow-hidden">
              <img src={game.thumb} alt={game.title} className="absolute inset-0 h-full w-full object-cover" loading="eager" width={1024} height={1024} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 35%, oklch(0.13 0.02 45 / 0.92))" }} />
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.8, repeat: Infinity }} className="absolute bottom-5 left-5 rounded-2xl bg-black/35 px-4 py-3 backdrop-blur">
                <p className="text-xs uppercase tracking-widest opacity-75">Gameplay Preview</p>
                <p className="font-display text-2xl font-bold">{game.preview}</p>
              </motion.div>
            </div>
            <div className="p-5 sm:p-7">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[oklch(0.18_0.03_50)]" style={{ background: BOOKLINK_GOLD }}>
                <Gamepad2 className="h-3.5 w-3.5" /> {game.difficulty}
              </div>
              <h1 className="mt-4 font-display text-4xl sm:text-6xl font-extrabold">{game.title}</h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-[oklch(0.97_0.02_75_/_0.75)]">{game.description}</p>
            </div>
          </motion.section>

          <motion.aside initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-4">
            <div className="rounded-[2rem] bg-[oklch(0.99_0.01_80)] p-5 text-[oklch(0.18_0.03_50)] shadow-2xl">
              <div className="grid grid-cols-3 gap-2 text-center">
                <InfoTile icon={Trophy} label="Level" value={`${level}/${MAX_LEVEL}`} />
                <InfoTile icon={Crosshair} label="Best" value={String(best)} />
                <InfoTile icon={Play} label="Play" value={String(plays)} />
              </div>
              <div className="mt-5 rounded-2xl p-4" style={{ background: "oklch(0.94 0.04 75)" }}>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-70"><span>Reward berikutnya</span><span>Lvl {nextReward}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[oklch(0.82_0.06_75)]"><div className="h-full" style={{ width: `${rewardProgress}%`, background: BOOKLINK_GOLD }} /></div>
                <p className="mt-2 text-xs opacity-75">Random 0.2 / 0.5 / 1 coin • Sisa hari ini {fmtCoins(stats.data?.remaining_tenths ?? 30)} coin</p>
              </div>
            </div>

            <div className="rounded-[2rem] bg-[oklch(0.99_0.01_80)] p-5 text-[oklch(0.18_0.03_50)] shadow-2xl">
              <h2 className="font-display text-2xl font-bold">Objective</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {game.objectives.map((o) => <li key={o} className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.62_0.13_50)]" />{o}</li>)}
              </ul>
            </div>

            {user ? (
              limitReached ? <button onClick={() => setLimitOpen(true)} className="w-full rounded-full px-6 py-4 font-bold text-[oklch(0.18_0.03_50)] shadow-2xl" style={{ background: BOOKLINK_GOLD }}>Main Sekarang</button> :
              <Link to="/mini-games/$gameId/play" params={{ gameId }} className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-bold text-[oklch(0.18_0.03_50)] shadow-2xl transition hover:scale-[1.02]" style={{ background: BOOKLINK_GOLD }}><Play className="h-5 w-5" /> Main Sekarang</Link>
            ) : (
              <Link to="/login" className="block w-full rounded-full px-6 py-4 text-center font-bold text-[oklch(0.18_0.03_50)] shadow-2xl" style={{ background: BOOKLINK_GOLD }}>Login untuk Main</Link>
            )}
          </motion.aside>
        </div>
      </div>
      <AnimatePresence>{limitOpen && <LimitModal onClose={() => setLimitOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-2xl p-3" style={{ background: "oklch(0.94 0.04 75)" }}><Icon className="mx-auto h-4 w-4 opacity-70" /><p className="mt-1 text-[10px] uppercase tracking-widest opacity-60">{label}</p><p className="font-display text-xl font-bold">{value}</p></div>;
}

function LimitModal({ onClose }: { onClose: () => void }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-black/70 px-4 backdrop-blur-md" onClick={onClose}><motion.div initial={{ scale: 0.92, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-[oklch(0.99_0.01_80)] p-6 text-center text-[oklch(0.18_0.03_50)] shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-3xl" style={{ background: BOOKLINK_GOLD }}>🚫</div><h2 className="mt-4 font-display text-2xl font-bold">Limit reward tercapai</h2><p className="mt-2 text-sm opacity-75">Kamu sudah mencapai batas maksimal reward game hari ini. Gameplay terkunci sementara dan reset otomatis besok.</p><button onClick={onClose} className="mt-5 w-full rounded-full px-5 py-3 text-sm font-bold text-[oklch(0.18_0.03_50)]" style={{ background: BOOKLINK_GOLD }}>Mengerti</button></motion.div></motion.div>;
}

const LEGACY_GAME_SLUGS: Record<string, string> = {
  flappy: "flappy-bookbird",
  "flappy-bookbird": "flappy-bookbird",
  memory: "memory-match",
  "memory-match": "memory-match",
  reflex: "reflex-strike",
  "reflex-strike": "reflex-strike",
  tap: "target-hunt",
  "tap-frenzy": "target-hunt",
  "target-hunt": "target-hunt",
  puzzle: "puzzle",
  "number-rush": "puzzle",
};