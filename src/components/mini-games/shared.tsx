import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, Trophy, Volume2, VolumeX } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { claimGameReward, getGameStats, recordGamePlay, type ClaimResult } from "@/lib/games.functions";
import { useAuth } from "@/hooks/use-auth";

export const MAX_LEVEL = 10;

// Warm BookLink palette tokens (work in both light & dark via opacity-aware UI)
export const BOOKLINK_BG = "linear-gradient(135deg, oklch(0.22 0.04 45) 0%, oklch(0.18 0.03 50) 45%, oklch(0.13 0.02 45) 100%)";
export const BOOKLINK_GOLD = "linear-gradient(135deg, oklch(0.82 0.13 80), oklch(0.72 0.13 65) 60%, oklch(0.55 0.13 45))";

export function fmtCoins(tenths: number) {
  return (tenths / 10).toFixed(1).replace(/\.0$/, "");
}

// -------- Audio --------
const SOUND_KEY = "minigames-mute";
export function useMute() {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try { setMuted(localStorage.getItem(SOUND_KEY) === "1"); } catch {}
  }, []);
  const toggle = () => {
    setMuted((m) => {
      const v = !m;
      try { localStorage.setItem(SOUND_KEY, v ? "1" : "0"); } catch {}
      return v;
    });
  };
  return { muted, toggle };
}
export function playBeep(muted: boolean, freq = 600, duration = 80, type: OscillatorType = "sine") {
  if (muted || typeof window === "undefined") return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = (playBeep as any)._ctx || ((playBeep as any)._ctx = new Ctx());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
    o.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

// -------- Game session hook (level + claim) --------
export function useGameSession(gameName: string) {
  const { refreshProfile } = useAuth();
  const qc = useQueryClient();
  const fetchStats = useServerFn(getGameStats);
  const record = useServerFn(recordGamePlay);
  const claim = useServerFn(claimGameReward);
  const [reward, setReward] = useState<{ tenths: number } | null>(null);
  const [limitNotice, setLimitNotice] = useState(false);

  const statsQ = useQuery({
    queryKey: ["game-stats"],
    queryFn: () => fetchStats(),
    staleTime: 4000,
  });

  const progressQ = useQuery({
    queryKey: ["game-progress", gameName],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("game_progress").select("*").eq("game_name", gameName).maybeSingle();
      return (data as any) ?? { level: 1, best_score: 0, total_plays: 0 };
    },
  });

  const recordMut = useMutation({
    mutationFn: (v: { score: number; level_completed: boolean }) =>
      record({ data: { game_name: gameName, score: v.score, level_completed: v.level_completed } }),
    onSuccess: async (r) => {
      qc.invalidateQueries({ queryKey: ["game-progress", gameName] });
      qc.invalidateQueries({ queryKey: ["game-stats"] });
      if (r.reached_max) {
        await tryClaim();
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal menyimpan progress"),
  });

  const claimMut = useMutation({
    mutationFn: () => claim({ data: { game_name: gameName } }),
    onSuccess: (r: ClaimResult) => {
      qc.invalidateQueries({ queryKey: ["game-stats"] });
      qc.invalidateQueries({ queryKey: ["game-progress", gameName] });
      refreshProfile();
      if (r.status === "limit_reached") {
        setLimitNotice(true);
        toast.info("Batas reward harian 3 coin tercapai. Kamu masih bisa bermain tanpa reward tambahan hari ini.");
        return;
      }
      if (r.status === "level_required") {
        toast.error(`Capai level ${r.required_level} dulu untuk klaim reward.`);
        return;
      }
      if (r.reward_tenths) setReward({ tenths: r.reward_tenths });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal claim reward"),
  });

  async function tryClaim() {
    await claimMut.mutateAsync();
  }

  function onLevelComplete(score: number) {
    recordMut.mutate({ score, level_completed: true });
  }
  function onPlay(score: number) {
    recordMut.mutate({ score, level_completed: false });
  }

  return {
    stats: statsQ.data,
    progress: progressQ.data ?? { level: 1, best_score: 0, total_plays: 0 },
    reward, dismissReward: () => setReward(null),
    limitNotice,
    onLevelComplete,
    onPlay,
    rewardPending: claimMut.isPending,
  };
}

// -------- UI bits --------
export function GamePageShell({ title, subtitle, accent, mascot, thumb, children }: {
  title: string; subtitle: string; accent?: string; mascot?: string; thumb?: string; children: React.ReactNode;
}) {
  const { muted, toggle } = useMute();
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: accent ?? BOOKLINK_BG }}>
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl" style={{ background: "oklch(0.62 0.13 50 / 0.45)" }} />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl" style={{ background: "oklch(0.82 0.13 80 / 0.30)" }} />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link to="/mini-games" className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.99_0.01_80)] px-4 py-2 text-sm font-medium text-[oklch(0.18_0.03_50)] shadow-lg hover:scale-[1.02] transition">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
          <button onClick={toggle} aria-label="Sound" className="grid h-10 w-10 place-items-center rounded-full bg-[oklch(0.99_0.01_80)] text-[oklch(0.18_0.03_50)] shadow-lg hover:scale-[1.05] transition">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center gap-4 mb-6 text-[oklch(0.97_0.02_75)] drop-shadow">
          {thumb ? (
            <div className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl ring-2 ring-[oklch(0.82_0.13_80_/_0.5)] shadow-xl shrink-0">
              <img src={thumb} alt={title} className="h-full w-full object-cover" loading="lazy" width={1024} height={1024} />
            </div>
          ) : mascot ? (
            <div className="text-6xl">{mascot}</div>
          ) : null}
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
            <p className="text-sm opacity-90">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LevelHUD({ level, best, plays, limitNotice }: { level: number; best: number; plays: number; limitNotice: boolean }) {
  const pct = Math.min(100, (level / MAX_LEVEL) * 100);
  return (
    <div className="rounded-2xl bg-[oklch(0.99_0.01_80)] p-4 shadow-xl text-[oklch(0.18_0.03_50)]">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4" style={{ color: "oklch(0.72 0.13 65)" }} /> Level {level} / {MAX_LEVEL}</span>
        <span className="text-xs opacity-70">Best {best} • {plays} plays</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: "oklch(0.92 0.025 75)" }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }}
          className="h-full"
          style={{ background: BOOKLINK_GOLD }}
        />
      </div>
      {level >= MAX_LEVEL && !limitNotice && (
        <div className="mt-2 text-xs font-medium" style={{ color: "oklch(0.55 0.13 45)" }}>Level {MAX_LEVEL} tercapai! Reward sedang diberikan…</div>
      )}
      {limitNotice && (
        <div className="mt-2 text-xs font-medium" style={{ color: "oklch(0.55 0.18 60)" }}>Batas reward harian tercapai — kamu masih bisa bermain, coin tidak diberikan lagi hari ini.</div>
      )}
    </div>
  );
}

export function RewardCinematic({ tenths, onDone }: { tenths: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-md"
        onClick={onDone}
      >
        <motion.div
          initial={{ scale: 0.4, y: 60, rotate: -8 }}
          animate={{ scale: 1, y: 0, rotate: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12 }}
          className="relative rounded-[2rem] p-10 text-center text-white shadow-2xl"
          style={{ background: BOOKLINK_GOLD }}
        >
          {Array.from({ length: 32 }).map((_, i) => (
            <motion.span key={i}
              className="absolute h-2.5 w-2.5 rounded-sm"
              style={{ background: ["#fff7e6","#fde047","#f5deb3","#d2b48c","#deb887"][i%5], left: "50%", top: "50%" }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: [0,1,0], x: (Math.random()-0.5)*420, y: -180 - Math.random()*120, rotate: 720 }}
              transition={{ duration: 1.8, delay: i*0.02, ease: "easeOut" }}
            />
          ))}
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.7 }}
            className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/20 backdrop-blur"
          >
            <Coins className="h-12 w-12 text-yellow-100" />
          </motion.div>
          <div className="mt-4 font-display text-5xl font-extrabold drop-shadow-lg">+{fmtCoins(tenths)}</div>
          <div className="mt-1 text-base font-semibold opacity-95">Coin Reward</div>
          <div className="mt-3 text-xs opacity-90">Coin sudah masuk ke balance kamu</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
