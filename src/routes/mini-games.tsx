import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Coins, Flame, Sparkles, Gamepad2, Lock, Play } from "lucide-react";
import { getGameStats, getGameProgress } from "@/lib/games.functions";
import { fmtCoins, BOOKLINK_BG, BOOKLINK_GOLD, MAX_LEVEL } from "@/components/mini-games/shared";
import { useAuth } from "@/hooks/use-auth";
import flappyThumb from "@/assets/games/flappy.jpg";
import memoryThumb from "@/assets/games/memory.jpg";
import reflexThumb from "@/assets/games/reflex.jpg";
import tapThumb from "@/assets/games/tap.jpg";
import puzzleThumb from "@/assets/games/puzzle.jpg";

export const Route = createFileRoute("/mini-games")({
  head: () => ({
    meta: [
      { title: "Mini Games — BookLink Arcade" },
      { name: "description", content: "Main mini games di BookLink dan dapatkan coin reward setiap hari. Flappy BookBird, Memory Match, Reflex Strike, dan lainnya." },
    ],
  }),
  component: MiniGamesHub,
});

type Game = {
  id: string; slug: string; title: string; tagline: string;
  thumb: string; difficulty: "Mudah" | "Sedang" | "Sulit";
};

const GAMES: Game[] = [
  { id: "flappy", slug: "flappy-bookbird", title: "Flappy BookBird", tagline: "Terbang melewati pilar buku", thumb: flappyThumb, difficulty: "Sedang" },
  { id: "memory", slug: "memory-match", title: "Memory Match", tagline: "Cocokkan pasangan kartu kuno", thumb: memoryThumb, difficulty: "Mudah" },
  { id: "reflex", slug: "reflex-strike", title: "Reflex Strike", tagline: "Uji kecepatan reaksi pasir waktu", thumb: reflexThumb, difficulty: "Sulit" },
  { id: "tap", slug: "target-hunt", title: "Target Hunt", tagline: "Tap target sebanyak mungkin dalam 10 detik", thumb: tapThumb, difficulty: "Mudah" },
  { id: "puzzle", slug: "puzzle", title: "Number Rush", tagline: "Tap angka 1-9 berurutan", thumb: puzzleThumb, difficulty: "Sedang" },
];

function MiniGamesHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchStats = useServerFn(getGameStats);
  const fetchProgress = useServerFn(getGameProgress);
  const stats = useQuery({ queryKey: ["game-stats"], queryFn: () => fetchStats(), enabled: !!user });
  const progress = useQuery({ queryKey: ["game-progress-all"], queryFn: () => fetchProgress(), enabled: !!user });

  const progressMap = new Map((progress.data ?? []).map((p) => [p.game_name, p]));
  const limitReached = (stats.data?.remaining_tenths ?? 30) <= 0;
  const onGameClick = (e: React.MouseEvent, slug: string) => {
    console.info(`[BookLink Arcade] navigate requested: /mini-games/${slug}/play`);
    if (!user) {
      e.preventDefault();
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: BOOKLINK_BG }}>
      <div className="pointer-events-none absolute inset-0">
        <motion.div animate={{ y: [0, 30, 0], x: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity }}
          className="absolute top-10 left-10 h-72 w-72 rounded-full blur-3xl" style={{ background: "oklch(0.62 0.13 50 / 0.30)" }} />
        <motion.div animate={{ y: [0, -25, 0], x: [0, -15, 0] }} transition={{ duration: 14, repeat: Infinity }}
          className="absolute bottom-10 right-10 h-80 w-80 rounded-full blur-3xl" style={{ background: "oklch(0.82 0.13 80 / 0.22)" }} />
        <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-1/3 right-1/4 h-56 w-56 rounded-full blur-3xl" style={{ background: "oklch(0.78 0.13 80 / 0.18)" }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 text-[oklch(0.97_0.02_75)]">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs font-medium mb-4 border border-[oklch(0.82_0.13_80_/_0.35)]">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.82 0.13 80)" }} /> BookLink Arcade
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight">
            Main, Naik Level, <span className="text-transparent bg-clip-text" style={{ backgroundImage: BOOKLINK_GOLD }}>Dapatkan Coin</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[oklch(0.97_0.02_75_/_0.75)] max-w-2xl mx-auto">
            Capai level 10 di setiap game untuk membuka random coin reward (0.2 – 1 coin). Maksimal 3 coin per hari.
          </p>
        </motion.div>

        {user && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <StatTile icon={Coins} label="Coin hari ini" value={`${fmtCoins(stats.data?.used_tenths ?? 0)} / 3`} />
            <StatTile icon={Trophy} label="Level tertinggi" value={String(stats.data?.highest_level ?? 0)} />
            <StatTile icon={Gamepad2} label="Total play" value={String(stats.data?.total_plays ?? 0)} />
            <StatTile icon={Flame} label="Total reward" value={fmtCoins(stats.data?.total_rewards_tenths ?? 0)} />
          </motion.div>
        )}

        {limitReached && user && (
          <div className="mb-6 rounded-2xl border p-4 text-sm" style={{ borderColor: "oklch(0.82 0.13 80 / 0.4)", background: "oklch(0.82 0.13 80 / 0.10)", color: "oklch(0.92 0.06 80)" }}>
            Kamu sudah mencapai batas reward harian (3 coin). Kamu masih bisa bermain, tetapi tidak akan mendapatkan coin lagi hari ini.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((g, i) => {
            const p = progressMap.get(g.id);
            const level = p?.level ?? 1;
            const locked = !user;
            const nextReward = Math.min(MAX_LEVEL, (Math.floor(level / 10) + 1) * 10);
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              >
                <Link
                  to="/mini-games/$gameId/play" params={{ gameId: g.slug }}
                  onClick={(e) => onGameClick(e, g.slug)}
                  className={`group block rounded-3xl overflow-hidden ring-1 ring-[oklch(0.82_0.13_80_/_0.18)] hover:ring-[oklch(0.82_0.13_80_/_0.6)] hover:-translate-y-1 transition-all shadow-2xl ${limitReached ? "opacity-60" : ""}`}
                  style={{ background: "oklch(0.18 0.025 45)" }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={g.thumb} alt={g.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" width={1024} height={1024} />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, oklch(0.13 0.02 45 / 0.85))" }} />
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur px-3 py-1 text-xs font-semibold text-white border border-[oklch(0.82_0.13_80_/_0.35)]">
                      Lvl {level}/{MAX_LEVEL}
                    </div>
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[oklch(0.18_0.03_50)]" style={{ background: BOOKLINK_GOLD }}>
                      {g.difficulty}
                    </div>
                    {locked && (
                      <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2 text-white">
                          <Lock className="h-8 w-8" />
                          <span className="text-xs font-semibold">Login dulu</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 text-[oklch(0.97_0.02_75)]">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-bold">{g.title}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.18_0.03_50)]" style={{ background: BOOKLINK_GOLD }}>
                        <Play className="h-3 w-3" /> Main
                      </span>
                    </div>
                    <p className="text-sm text-[oklch(0.97_0.02_75_/_0.65)]">{g.tagline}</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "oklch(0.97 0.02 75 / 0.1)" }}>
                      <div className="h-full transition-all" style={{ width: `${(level / MAX_LEVEL) * 100}%`, background: BOOKLINK_GOLD }} />
                    </div>
                    <div className="mt-2 text-[11px] text-[oklch(0.97_0.02_75_/_0.55)]">Reward berikutnya di Lvl {nextReward} • 0.2 – 1 coin</div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {!user && (
          <div className="mt-10 text-center text-white/80">
            <Link to="/login" className="inline-block rounded-full px-6 py-3 font-semibold shadow-xl hover:scale-105 transition text-[oklch(0.18_0.03_50)]" style={{ background: BOOKLINK_GOLD }}>
              Login dulu untuk main
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 backdrop-blur border border-[oklch(0.82_0.13_80_/_0.25)] p-4">
      <div className="flex items-center gap-2 text-xs text-[oklch(0.97_0.02_75_/_0.7)]"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
