import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GamePageShell, LevelHUD, RewardCinematic, useGameSession, useMute, playBeep, BOOKLINK_GOLD } from "@/components/mini-games/shared";
import flappyThumb from "@/assets/games/flappy.jpg";
import memoryThumb from "@/assets/games/memory.jpg";
import reflexThumb from "@/assets/games/reflex.jpg";
import tapThumb from "@/assets/games/tap.jpg";
import puzzleThumb from "@/assets/games/puzzle.jpg";

export const Route = createFileRoute("/mini-games_/$gameId/play")({
  head: ({ params }) => ({
    meta: [{ title: `${labelFor(params.gameId)} — BookLink Arcade` }],
  }),
  component: GameDispatcher,
});

const GAME_ALIASES: Record<string, "flappy" | "memory" | "reflex" | "tap" | "puzzle"> = {
  flappy: "flappy",
  "flappy-bookbird": "flappy",
  memory: "memory",
  "memory-match": "memory",
  reflex: "reflex",
  "reflex-strike": "reflex",
  tap: "tap",
  "tap-frenzy": "tap",
  "target-hunt": "tap",
  puzzle: "puzzle",
  "number-rush": "puzzle",
};

// Warm BookLink backgrounds for each game
const META: Record<string, { title: string; subtitle: string; thumb: string; bg: string }> = {
  flappy:  { title: "Flappy BookBird", subtitle: "Tap untuk terbang lewati pilar buku", thumb: flappyThumb,
             bg: "linear-gradient(180deg, oklch(0.42 0.10 50) 0%, oklch(0.55 0.13 55) 55%, oklch(0.72 0.13 65) 100%)" },
  memory:  { title: "Memory Match",    subtitle: "Cocokkan semua pasangan kartu kuno", thumb: memoryThumb,
             bg: "linear-gradient(135deg, oklch(0.22 0.04 45), oklch(0.32 0.06 45) 60%, oklch(0.45 0.10 50))" },
  reflex:  { title: "Reflex Strike",   subtitle: "Tap saat hijau, jangan terlalu cepat", thumb: reflexThumb,
             bg: "linear-gradient(135deg, oklch(0.16 0.03 45), oklch(0.28 0.06 50) 55%, oklch(0.55 0.13 45))" },
  tap:     { title: "Tap Frenzy",      subtitle: "Tap sebanyak mungkin sebelum waktu habis", thumb: tapThumb,
             bg: "linear-gradient(135deg, oklch(0.42 0.13 45), oklch(0.55 0.15 45) 55%, oklch(0.72 0.13 65))" },
  puzzle:  { title: "Number Rush",     subtitle: "Tap angka 1-9 berurutan secepat mungkin", thumb: puzzleThumb,
             bg: "linear-gradient(135deg, oklch(0.32 0.05 50), oklch(0.45 0.10 50) 55%, oklch(0.78 0.13 80))" },
};

function normalizeGameId(id: string) { return GAME_ALIASES[id] ?? null; }
function labelFor(id: string) { const key = normalizeGameId(id); return key ? META[key].title : "Mini Game"; }

function GameDispatcher() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const activeGame = normalizeGameId(gameId);
  const m = activeGame ? META[activeGame] : null;
  useEffect(() => {
    console.info(`[BookLink Arcade] gameplay route mounted: /mini-games/${gameId}/play`);
    if (!m) navigate({ to: "/mini-games" });
  }, [gameId, m, navigate]);
  if (!m || !activeGame) return null;
  const session = useGameSession(activeGame);

  return (
    <GamePageShell title={m.title} subtitle={m.subtitle} accent={m.bg} thumb={m.thumb}>
      <LevelHUD level={session.progress.level} best={session.progress.best_score} plays={session.progress.total_plays} limitNotice={session.limitNotice} />

      <div className="mt-5 rounded-3xl bg-[oklch(0.99_0.01_80)] p-4 sm:p-6 shadow-2xl text-[oklch(0.18_0.03_50)]">
        {activeGame === "flappy" && <FlappyGame session={session} />}
        {activeGame === "memory" && <MemoryGame session={session} />}
        {activeGame === "reflex" && <ReflexGame session={session} />}
        {activeGame === "tap" && <TapGame session={session} />}
        {activeGame === "puzzle" && <PuzzleGame session={session} />}
      </div>

      {session.reward && <RewardCinematic tenths={session.reward.tenths} onDone={session.dismissReward} />}
    </GamePageShell>
  );
}

type Session = ReturnType<typeof useGameSession>;

// ============================================================
// 🐦 Flappy BookBird (warm BookLink theme + fixed score ref)
// ============================================================
function FlappyGame({ session }: { session: Session }) {
  const W = 360, H = 480;
  const GRAVITY = 0.45, FLAP = -7.5, GAP = 130, PIPE_W = 56, SPEED_BASE = 2.2;
  const { muted } = useMute();
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const yRef = useRef(H / 2);
  const vRef = useRef(0);
  const pipesRef = useRef<{ x: number; gapY: number; passed: boolean }[]>([]);
  const tickRef = useRef<any>(null);
  const scoreRef = useRef(0);
  const deadRef = useRef(false);
  const [, force] = useState(0);
  const level = session.progress.level;
  const speed = SPEED_BASE + Math.min(level * 0.05, 4);
  const required = 3 + Math.min(Math.floor(level / 5), 17);

  const reset = () => {
    yRef.current = H / 2; vRef.current = 0;
    pipesRef.current = [{ x: W + 50, gapY: 160 + Math.random() * (H - 320), passed: false }];
    scoreRef.current = 0;
    deadRef.current = false;
    setScore(0); setDead(false);
  };
  const start = () => { reset(); setRunning(true); };
  const flap = () => {
    if (deadRef.current) return;
    if (!running) { start(); return; }
    vRef.current = FLAP;
    playBeep(muted, 700, 70, "square");
  };

  const die = () => {
    if (deadRef.current) return;
    deadRef.current = true;
    clearInterval(tickRef.current);
    setDead(true); setRunning(false);
    playBeep(muted, 200, 250, "sawtooth");
    const final = scoreRef.current;
    const completed = final >= required;
    if (completed) session.onLevelComplete(final);
    else session.onPlay(final);
  };

  useEffect(() => {
    if (!running || dead) return;
    tickRef.current = setInterval(() => {
      vRef.current += GRAVITY;
      yRef.current += vRef.current;
      pipesRef.current = pipesRef.current.map((p) => ({ ...p, x: p.x - speed }));
      const last = pipesRef.current[pipesRef.current.length - 1];
      if (!last || last.x < W - 200) {
        pipesRef.current.push({ x: W + 30, gapY: 100 + Math.random() * (H - 240), passed: false });
      }
      pipesRef.current = pipesRef.current.filter((p) => p.x + PIPE_W > -10);
      const birdX = 70, birdR = 16;
      for (const p of pipesRef.current) {
        if (!p.passed && p.x + PIPE_W < birdX) {
          p.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
          playBeep(muted, 1000, 50);
        }
        if (birdX + birdR > p.x && birdX - birdR < p.x + PIPE_W) {
          if (yRef.current - birdR < p.gapY - GAP / 2 || yRef.current + birdR > p.gapY + GAP / 2) {
            die();
            return;
          }
        }
      }
      if (yRef.current > H - 16 || yRef.current < 16) { die(); return; }
      force((n) => n + 1);
    }, 1000 / 60);
    return () => clearInterval(tickRef.current);
  }, [running, dead, speed, muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); flap(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="text-center">
      <div className="flex items-center justify-between mb-3 text-sm font-semibold">
        <span>Score: <span style={{ color: "oklch(0.55 0.13 45)" }}>{score}</span></span>
        <span>Target Lvl {level}: <span style={{ color: "oklch(0.62 0.13 50)" }}>{required}</span> pilar</span>
      </div>
      <div
        onPointerDown={(e) => { e.preventDefault(); flap(); }}
        className="relative mx-auto overflow-hidden rounded-2xl select-none cursor-pointer touch-none shadow-xl"
        style={{ width: W, height: H, maxWidth: "100%", background: "linear-gradient(180deg,#f5deb3 0%,#e8c897 55%,#c19a6b 100%)" }}
      >
        <motion.div animate={{ x: [-50, W] }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          className="absolute top-10 text-3xl opacity-70">☁️</motion.div>
        <motion.div animate={{ x: [-100, W] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-24 text-2xl opacity-60">☁️</motion.div>

        {/* book-column pipes */}
        {pipesRef.current.map((p, i) => (
          <div key={i}>
            <div className="absolute" style={{ left: p.x, top: 0, width: PIPE_W, height: p.gapY - GAP / 2, background: "linear-gradient(90deg,#6b3a1a,#8b5a2b 40%,#a0522d 60%,#6b3a1a)", borderRight: "3px solid #3a1f0e", borderBottom: "5px solid #422006", boxShadow: "inset 0 0 0 1px rgba(245,222,179,0.2)" }} />
            <div className="absolute" style={{ left: p.x, top: p.gapY + GAP / 2, width: PIPE_W, height: H - (p.gapY + GAP / 2), background: "linear-gradient(90deg,#6b3a1a,#8b5a2b 40%,#a0522d 60%,#6b3a1a)", borderRight: "3px solid #3a1f0e", borderTop: "5px solid #422006", boxShadow: "inset 0 0 0 1px rgba(245,222,179,0.2)" }} />
          </div>
        ))}

        {/* ground */}
        <div className="absolute bottom-0 left-0 right-0 h-4" style={{ background: "linear-gradient(180deg,#6b3a1a,#3a1f0e)" }} />

        {/* bird */}
        <div className="absolute text-3xl transition-transform" style={{ left: 70 - 16, top: yRef.current - 18, transform: `rotate(${Math.max(-30, Math.min(60, vRef.current * 4))}deg)`, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>🐦</div>

        {!running && !dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-sm">
            <Button size="lg" onClick={start} className="text-[oklch(0.18_0.03_50)] font-bold" style={{ background: BOOKLINK_GOLD }}>Tap untuk mulai</Button>
          </div>
        )}
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur">
            <div className="text-center text-white">
              <div className="text-4xl mb-1">💥</div>
              <div className="font-display text-2xl font-bold">Game Over</div>
              <div className="text-sm opacity-90">Score {score} • Target {required}</div>
              <Button className="mt-3 text-[oklch(0.18_0.03_50)] font-bold" style={{ background: BOOKLINK_GOLD }} onClick={start}>Coba lagi</Button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs opacity-70">Tap layar / Space untuk terbang. Lewati {required} pilar untuk naik level.</p>
    </div>
  );
}

// ============================================================
// 🧠 Memory Match
// ============================================================
function MemoryGame({ session }: { session: Session }) {
  const level = session.progress.level;
  const pairs = Math.min(8, 3 + Math.floor(level / 8));
  const symbols = ["📕","📜","🪶","🗝️","🕯️","📖","🎭","⚜️"].slice(0, pairs);
  const { muted } = useMute();
  const buildDeck = () => {
    const deck = [...symbols, ...symbols].map((s, i) => ({ s, key: i, open: false, done: false }));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
  };
  const [deck, setDeck] = useState(buildDeck);
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const wonRef = useRef(false);

  useEffect(() => { setDeck(buildDeck()); setPicked([]); setMoves(0); wonRef.current = false; }, [level]);

  const flip = (idx: number) => {
    if (deck[idx].open || deck[idx].done || picked.length >= 2) return;
    playBeep(muted, 500, 40);
    const nd = deck.map((c, i) => (i === idx ? { ...c, open: true } : c));
    const np = [...picked, idx];
    setDeck(nd); setPicked(np);
    if (np.length === 2) {
      setMoves((m) => m + 1);
      setTimeout(() => {
        const [a, b] = np;
        const match = nd[a].s === nd[b].s;
        const upd = nd.map((c, i) => (i === a || i === b ? { ...c, open: match, done: match } : c));
        setDeck(upd); setPicked([]);
        if (match) playBeep(muted, 900, 80);
        if (upd.every((c) => c.done) && !wonRef.current) {
          wonRef.current = true;
          session.onLevelComplete(Math.max(0, 100 - moves));
        }
      }, 500);
    }
  };

  return (
    <div>
      <div className="flex justify-between text-sm font-semibold mb-3">
        <span>Pasangan: {pairs}</span>
        <span>Moves: {moves}</span>
      </div>
      <div className="grid gap-2 max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(4, minmax(0,1fr))` }}>
        {deck.map((c, i) => (
          <button key={c.key} onClick={() => flip(i)}
            className={`relative aspect-square rounded-xl text-3xl sm:text-4xl font-bold transition-all duration-300 border-2`}
            style={
              c.open || c.done
                ? { background: "linear-gradient(135deg,#fff7e6,#f5deb3)", borderColor: "oklch(0.72 0.13 65)", color: "oklch(0.32 0.10 45)" }
                : { background: BOOKLINK_GOLD, borderColor: "oklch(0.45 0.13 45)", color: "oklch(0.18 0.03 50)" }
            }
          >
            {c.open || c.done ? c.s : "✦"}
          </button>
        ))}
      </div>
      <div className="mt-4 text-center">
        <Button variant="outline" onClick={() => { setDeck(buildDeck()); setPicked([]); setMoves(0); wonRef.current = false; }}>Reset</Button>
      </div>
    </div>
  );
}

// ============================================================
// ⚡ Reflex Strike
// ============================================================
function ReflexGame({ session }: { session: Session }) {
  const level = session.progress.level;
  const threshold = Math.max(220, 600 - Math.min(level, 10) * 35);
  const ROUNDS = 5;
  const { muted } = useMute();
  const [state, setState] = useState<"idle"|"wait"|"go"|"done">("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const startAt = useRef(0);
  const tRef = useRef<any>(null);

  const next = () => {
    setState("wait");
    tRef.current = setTimeout(() => { startAt.current = performance.now(); setState("go"); playBeep(muted, 880, 80); }, 800 + Math.random() * 2200);
  };
  const begin = () => { setRound(0); setTimes([]); next(); };
  const tap = () => {
    if (state === "wait") { clearTimeout(tRef.current); setState("idle"); playBeep(muted, 200, 120, "sawtooth"); return; }
    if (state !== "go") return;
    const t = performance.now() - startAt.current;
    const nt = [...times, t]; setTimes(nt);
    if (round + 1 >= ROUNDS) {
      const avg = nt.reduce((a, b) => a + b, 0) / nt.length;
      setState("done");
      if (avg <= threshold) session.onLevelComplete(Math.round(avg));
      else session.onPlay(Math.round(avg));
    } else { setRound((r) => r + 1); next(); }
  };
  useEffect(() => () => clearTimeout(tRef.current), []);
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  return (
    <div className="text-center">
      <div className="flex justify-between text-sm font-semibold mb-3">
        <span>Ronde: {Math.min(round + (state === "go" ? 1 : 0), ROUNDS)}/{ROUNDS}</span>
        <span>Target Lvl {level}: &lt; {threshold}ms</span>
      </div>
      {state === "idle" || state === "done" ? (
        <div className="py-8">
          {state === "done" && <div className="mb-3 text-lg font-bold">Avg {Math.round(avg)}ms</div>}
          <Button size="lg" onClick={begin} className="text-[oklch(0.18_0.03_50)] font-bold" style={{ background: BOOKLINK_GOLD }}>{state === "done" ? "Main lagi" : "Mulai"}</Button>
        </div>
      ) : (
        <button onClick={tap}
          className="relative mx-auto grid h-56 w-full max-w-md place-items-center rounded-3xl font-display text-3xl text-white shadow-2xl transition-all overflow-hidden"
          style={{
            background: state === "go"
              ? "linear-gradient(135deg, oklch(0.72 0.18 145), oklch(0.55 0.20 145))"
              : "linear-gradient(135deg, oklch(0.55 0.20 30), oklch(0.42 0.18 25))",
          }}
        >
          {state === "go" && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 2.5, opacity: [0.6, 0] }} transition={{ duration: 1, repeat: Infinity }}
              className="absolute h-32 w-32 rounded-full bg-white/30" />
          )}
          <span className="relative drop-shadow-lg">{state === "go" ? "TAP!" : "Tunggu…"}</span>
        </button>
      )}
    </div>
  );
}

// ============================================================
// 👆 Tap Frenzy
// ============================================================
function TapGame({ session }: { session: Session }) {
  const level = session.progress.level;
  const goal = 18 + Math.min(level, 30);
  const TIME = 10;
  const { muted } = useMute();
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(TIME);
  const [running, setRunning] = useState(false);
  const wonRef = useRef(false);

  useEffect(() => { if (!running) return; const i = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100); return () => clearInterval(i); }, [running]);
  useEffect(() => {
    if (running && left <= 0) {
      setRunning(false);
      const completed = count >= goal;
      if (completed && !wonRef.current) { wonRef.current = true; session.onLevelComplete(count); }
      else session.onPlay(count);
    }
  }, [left, running, count, goal, session]);

  const start = () => { setCount(0); setLeft(TIME); wonRef.current = false; setRunning(true); };
  return (
    <div className="text-center py-2">
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm font-semibold">
        <div className="rounded-xl p-3" style={{ background: "oklch(0.93 0.04 75)" }}>Tap <div className="text-2xl" style={{ color: "oklch(0.55 0.13 45)" }}>{count}/{goal}</div></div>
        <div className="rounded-xl p-3" style={{ background: "oklch(0.92 0.05 65)" }}>Waktu <div className="text-2xl" style={{ color: "oklch(0.55 0.18 30)" }}>{left.toFixed(1)}s</div></div>
      </div>
      {!running ? (
        <Button size="lg" onClick={start} className="text-[oklch(0.18_0.03_50)] font-bold" style={{ background: BOOKLINK_GOLD }}>{count >= goal ? "Main lagi" : left <= 0 ? "Coba lagi" : "Mulai"}</Button>
      ) : (
        <motion.button
          onClick={() => { setCount((c) => c + 1); playBeep(muted, 700, 30); }}
          whileTap={{ scale: 0.9 }}
          className="mx-auto grid h-52 w-52 place-items-center rounded-full text-white font-display text-4xl shadow-2xl select-none"
          style={{ background: BOOKLINK_GOLD }}
        >TAP!</motion.button>
      )}
    </div>
  );
}

// ============================================================
// 🔢 Number Rush
// ============================================================
function PuzzleGame({ session }: { session: Session }) {
  const level = session.progress.level;
  const TIME = Math.max(5, 14 - Math.min(level, 8));
  const { muted } = useMute();
  function shuf() { const a = [1,2,3,4,5,6,7,8,9]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const [order, setOrder] = useState(shuf);
  const [next, setNext] = useState(1);
  const [left, setLeft] = useState(TIME);
  const [running, setRunning] = useState(false);
  const wonRef = useRef(false);

  useEffect(() => { if (!running) return; const i = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100); return () => clearInterval(i); }, [running]);
  useEffect(() => { if (running && left <= 0) { setRunning(false); session.onPlay(0); } }, [left, running, session]);

  const tap = (n: number) => {
    if (!running) return;
    if (n !== next) { setRunning(false); playBeep(muted, 200, 120, "sawtooth"); session.onPlay(next - 1); return; }
    playBeep(muted, 600 + n * 40, 50);
    if (n === 9 && !wonRef.current) { wonRef.current = true; setRunning(false); session.onLevelComplete(Math.round((TIME - left) * 100)); return; }
    setNext(n + 1);
  };
  const start = () => { setOrder(shuf()); setNext(1); setLeft(TIME); wonRef.current = false; setRunning(true); };
  return (
    <div className="text-center py-2">
      <div className="grid grid-cols-2 gap-3 mb-3 text-sm font-semibold">
        <div className="rounded-xl p-3" style={{ background: "oklch(0.93 0.04 75)" }}>Berikutnya <div className="text-2xl" style={{ color: "oklch(0.55 0.13 45)" }}>{running ? next : "—"}</div></div>
        <div className="rounded-xl p-3" style={{ background: "oklch(0.93 0.05 70)" }}>Waktu <div className="text-2xl" style={{ color: "oklch(0.55 0.13 50)" }}>{left.toFixed(1)}s</div></div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {order.map((n) => (
          <motion.button key={n} disabled={!running || n < next} onClick={() => tap(n)} whileTap={{ scale: 0.9 }}
            className="aspect-square rounded-xl text-3xl font-display font-bold border-2 transition-all"
            style={
              n < next
                ? { background: BOOKLINK_GOLD, borderColor: "oklch(0.55 0.13 45)", color: "oklch(0.18 0.03 50)" }
                : { background: "white", borderColor: "oklch(0.88 0.03 70)" }
            }>
            {n}
          </motion.button>
        ))}
      </div>
      <Button className="mt-4 text-[oklch(0.18_0.03_50)] font-bold" style={{ background: BOOKLINK_GOLD }} onClick={start}>{wonRef.current ? "Main lagi" : running ? "Restart" : "Mulai"}</Button>
    </div>
  );
}
