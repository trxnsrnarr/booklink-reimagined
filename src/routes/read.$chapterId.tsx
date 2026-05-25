import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Settings as Cog, BookOpen, Coins, Crown, Lock, Loader2, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import type { Chapter, Story } from "@/lib/types";
import { Comments } from "@/components/Comments";

export const Route = createFileRoute("/read/$chapterId")({
  component: ReaderPage,
});

type ReaderTheme = "parchment" | "sepia" | "night" | "ink";

const THEMES: { id: ReaderTheme; label: string; bg: string; fg: string }[] = [
  { id: "parchment", label: "Parchment", bg: "#f7efe1", fg: "#2b1f12" },
  { id: "sepia", label: "Sepia", bg: "#efe2c8", fg: "#3a2a17" },
  { id: "night", label: "Night", bg: "#0e1116", fg: "#e9e5d9" },
  { id: "ink", label: "Ink", bg: "#1a1410", fg: "#f5deb3" },
];

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}

function ReaderPage() {
  const { chapterId } = Route.useParams();
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [fontSize, setFontSize] = useState<number>(() => loadPref("reader.fontSize", 18));
  const [lineHeight, setLineHeight] = useState<number>(() => loadPref("reader.lineHeight", 1.8));
  const [themeId, setThemeId] = useState<ReaderTheme>(() => loadPref<ReaderTheme>("reader.theme", "parchment"));
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vipGateOpen, setVipGateOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => { localStorage.setItem("reader.fontSize", JSON.stringify(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem("reader.lineHeight", JSON.stringify(lineHeight)); }, [lineHeight]);
  useEffect(() => { localStorage.setItem("reader.theme", JSON.stringify(themeId)); }, [themeId]);

  // Record a chapter view exactly once per browser session
  useEffect(() => {
    if (typeof window === "undefined" || !chapterId) return;
    const key = `viewed:${chapterId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("record_chapter_view", { _chapter_id: chapterId }).then(({ error }) => {
      if (error) sessionStorage.removeItem(key);
    });
  }, [chapterId]);

  // Persist last-read chapter per user (Continue Reading)
  useEffect(() => {
    if (!user || !chapterId) return;
    supabase.rpc("record_reading_progress", { _chapter_id: chapterId }).then(({ error }) => {
      if (error) console.error("[reading_progress]", error);
    });
  }, [user, chapterId]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chapter", chapterId, user?.id],
    queryFn: async () => {
      const { data: chapter, error } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
      if (error) throw error;
      if (!chapter) return null;
      const ch = chapter as Chapter;
      const { data: story } = await supabase.from("stories").select("*").eq("id", ch.story_id).maybeSingle();
      const { data: all } = await supabase.from("chapters").select("id, order_index, title, is_premium").eq("story_id", ch.story_id).order("order_index");
      let chapterUnlocked = false;
      let storyVipUnlocked = false;
      if (user) {
        const { data: u } = await supabase.from("chapter_unlocks").select("chapter_id").eq("user_id", user.id).eq("chapter_id", ch.id).maybeSingle();
        chapterUnlocked = !!u;
        const { data: sv } = await supabase
          .from("user_unlocked_vip_stories")
          .select("story_id")
          .eq("user_id", user.id)
          .eq("story_id", ch.story_id)
          .maybeSingle();
        storyVipUnlocked = !!sv;
      }
      return { chapter: ch, story: story as Story | null, all: (all ?? []) as { id: string; order_index: number; title: string; is_premium: boolean }[], unlocked: chapterUnlocked, storyVipUnlocked };
    },
  });

  const isVip = useMemo(() => !!profile?.vip_until && new Date(profile.vip_until) > new Date(), [profile?.vip_until]);
  const vipLimit = profile?.vip_unlock_limit ?? 8;
  const vipUsed = profile?.vip_unlock_used ?? 0;
  const vipRemaining = Math.max(vipLimit - vipUsed, 0);
  const isAuthor = !!user && data?.story?.author_id === user.id;
  const needsAction = useMemo(() => {
    if (!data?.chapter || !data?.story) return null;
    if (isAuthor) return null;
    if (data.story.is_vip) {
      if (!isVip) return "vip-gate";
      if (data.storyVipUnlocked) return null;
      return "vip-unlock"; // VIP, but story not yet unlocked → consume a slot
    }
    if (data.chapter.is_premium && !data.unlocked) return "premium-confirm";
    return null;
  }, [data, isAuthor, isVip]);

  // Auto-open the right modal once data resolves
  useEffect(() => {
    if (!data) return;
    if (needsAction === "vip-gate") setVipGateOpen(true);
    else if (needsAction === "vip-unlock" || needsAction === "premium-confirm") setConfirmOpen(true);
    else { setVipGateOpen(false); setConfirmOpen(false); }
  }, [needsAction, data]);

  const theme = THEMES.find((tt) => tt.id === themeId)!;
  const activeBg = theme.bg;
  const activeFg = theme.fg;

  const doUnlock = async () => {
    if (!user) { toast.error("Login dulu."); navigate({ to: "/login" }); return; }
    setUnlocking(true);
    try {
      if (needsAction === "vip-unlock") {
        if (vipRemaining <= 0) {
          toast.error("Slot unlock VIP bulan ini sudah habis.");
          setConfirmOpen(false);
          return;
        }
        const { data: res, error } = await supabase.rpc("unlock_vip_story", { _story_id: data!.story!.id });
        if (error) throw error;
        const r = res as { status: string; remaining?: number; limit?: number };
        if (r.status === "limit_reached") { toast.error("Slot unlock VIP bulan ini sudah habis."); setConfirmOpen(false); return; }
        if (r.status === "vip_required") { setConfirmOpen(false); setVipGateOpen(true); return; }
        toast.success(r.status === "already_unlocked" ? "Cerita sudah ter-unlock." : `Cerita VIP terbuka! Sisa ${r.remaining ?? "-"} / ${r.limit ?? vipLimit}`);
        setConfirmOpen(false);
        await refreshProfile();
        await qc.invalidateQueries({ queryKey: ["chapter", chapterId, user.id] });
        refetch();
        return;
      }
      const { data: res, error } = await supabase.rpc("unlock_chapter", { _chapter_id: chapterId });
      if (error) throw error;
      const r = res as { status: string; needed?: number; balance?: number };
      if (r.status === "insufficient") {
        toast.error(`Koin kurang. Butuh ${r.needed}, saldo ${r.balance}.`);
        navigate({ to: "/wallet" });
        return;
      }
      if (r.status === "vip_required") { setConfirmOpen(false); setVipGateOpen(true); return; }
      if (r.status === "vip_unlock_required") {
        toast.error("Unlock cerita VIP dulu untuk membaca semua chapternya.");
        setConfirmOpen(false);
        return;
      }
      toast.success("Chapter terbuka!");
      setConfirmOpen(false);
      await refreshProfile();
      await qc.invalidateQueries({ queryKey: ["chapter", chapterId, user.id] });
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUnlocking(false);
    }
  };


  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  }
  if (isError || !data?.chapter) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-muted-foreground">{t("common.notFound")}</p>
        <Link to="/explore" className="text-primary">← Explore</Link>
      </div>
    );
  }

  const { chapter, story, all } = data;
  const idx = all.findIndex((c) => c.id === chapter.id);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  const locked = !!needsAction;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: activeBg, color: activeFg, transition: "background-color .4s ease, color .4s ease" }}>
      {story?.cover_url && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden opacity-30">
          <img src={story.cover_url} alt="" className="w-full h-full object-cover scale-110 blur-3xl" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${activeBg})` }} />
        </div>
      )}
      <div className="sticky top-16 z-30 backdrop-blur-md" style={{ backgroundColor: `${activeBg}cc`, borderBottom: `1px solid ${activeFg}1a` }}>
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/story/$slug" params={{ slug: story?.slug ?? "" }} className="inline-flex items-center gap-1.5 text-sm opacity-80 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> {story?.title?.slice(0, 30) ?? t("common.back")}
          </Link>
          <button onClick={() => setPanelOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border" style={{ borderColor: `${activeFg}33` }}>
            <Cog className="h-4 w-4" /> Aa
          </button>
        </div>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="sticky top-[8.25rem] z-20 mx-auto max-w-3xl px-4">
            <div className="rounded-2xl p-4 shadow-lg" style={{ backgroundColor: activeBg, border: `1px solid ${activeFg}22` }}>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="flex items-center justify-between mb-1.5"><span>{t("reader.fontSize")}</span><span className="opacity-60">{fontSize}px</span></label>
                  <input type="range" min={14} max={28} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-full accent-current" />
                </div>
                <div>
                  <label className="flex items-center justify-between mb-1.5"><span>{t("reader.lineHeight")}</span><span className="opacity-60">{lineHeight.toFixed(1)}</span></label>
                  <input type="range" min={1.4} max={2.4} step={0.1} value={lineHeight} onChange={(e) => setLineHeight(+e.target.value)} className="w-full accent-current" />
                </div>
                <div>
                  <p className="mb-2">{t("reader.theme")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {THEMES.map((th) => (
                      <button key={th.id}
                        onClick={() => setThemeId(th.id)}
                        className={`relative rounded-xl px-3 py-2.5 text-xs font-medium border ${themeId === th.id ? "ring-2 ring-offset-2" : ""}`}
                        style={{ backgroundColor: th.bg, color: th.fg, borderColor: `${th.fg}33` }}>
                        {th.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <article className="relative mx-auto max-w-3xl px-5 sm:px-8 py-10">
        <p className="text-xs uppercase tracking-widest opacity-60">Chapter {chapter.order_index}</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold" style={{ color: activeFg }}>{chapter.title}</h1>
        <ChapterLikeButton chapterId={chapter.id} activeBg={activeBg} activeFg={activeFg} />

        {locked ? (
          <div className="mt-10 rounded-2xl p-8 text-center" style={{ border: `1px dashed ${activeFg}55` }}>
            <Lock className="mx-auto h-10 w-10 opacity-70" />
            <p className="mt-4 font-semibold">
              {needsAction === "vip-gate" ? "Cerita VIP" : needsAction === "vip-unlock" ? "Unlock Cerita VIP" : "Chapter Berbayar"}
            </p>
            <p className="mt-2 text-sm opacity-80">
              {needsAction === "vip-gate" ? "Story ini hanya untuk member VIP." :
               needsAction === "vip-unlock" ? `Yakin ingin unlock cerita VIP ini? Sisa unlock VIP kamu: ${vipRemaining} / ${vipLimit}` :
                `Buka chapter ini dengan ${chapter.coin_price || 10} koin?`}
            </p>
            <button
              onClick={() => needsAction === "vip-gate" ? setVipGateOpen(true) : setConfirmOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 font-medium"
              style={{ backgroundColor: activeFg, color: activeBg }}
            >
              {needsAction === "vip-gate" ? <><Crown className="h-4 w-4" /> Upgrade VIP</> : needsAction === "vip-unlock" ? <><Crown className="h-4 w-4" /> Unlock Sekarang</> : <><Coins className="h-4 w-4" /> Buka</>}
            </button>
          </div>

        ) : (
          <div className="mt-8 prose prose-lg max-w-none [&_img]:rounded-xl [&_img]:my-4 [&_img]:mx-auto [&_img]:max-w-full [&_img]:h-auto"
            style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily: "Georgia, 'Playfair Display', serif", color: activeFg }}
            dangerouslySetInnerHTML={{ __html: chapter.content || "<p>(empty)</p>" }} />
        )}

        <div className="mt-12 flex items-center justify-between gap-3 pt-6" style={{ borderTop: `1px solid ${activeFg}22` }}>
          <button disabled={!prev} onClick={() => prev && navigate({ to: "/read/$chapterId", params: { chapterId: prev.id } })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm disabled:opacity-30" style={{ border: `1px solid ${activeFg}33` }}>
            <ArrowLeft className="h-4 w-4" /> {t("reader.prev")}
          </button>
          <Link to="/story/$slug" params={{ slug: story?.slug ?? "" }} className="inline-flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100">
            <BookOpen className="h-4 w-4" />
          </Link>
          <button disabled={!next} onClick={() => next && navigate({ to: "/read/$chapterId", params: { chapterId: next.id } })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm disabled:opacity-30 font-medium"
            style={{ backgroundColor: activeFg, color: activeBg }}>
            {t("reader.next")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {!locked && <Comments chapterId={chapter.id} />}
      </article>

      {/* Confirm unlock modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl bg-background text-foreground p-6 shadow-2xl">
              <div className="text-center">
                {needsAction === "vip-unlock" ? <Crown className="mx-auto h-10 w-10 text-vip" /> : <Coins className="mx-auto h-10 w-10 text-primary" />}
                <h3 className="mt-3 font-display text-xl font-semibold">
                  {needsAction === "vip-unlock" ? "Yakin ingin unlock cerita VIP ini?" : "Buka chapter ini?"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {needsAction === "vip-unlock"
                    ? <>Sisa unlock VIP kamu: <strong>{vipRemaining} / {vipLimit}</strong>. Setelah unlock, kamu bebas baca semua chapter cerita ini selama VIP aktif.</>
                    : `Biaya ${chapter.coin_price || 10} koin akan dipotong dari saldo (${profile?.coin_balance ?? 0} koin).`}
                </p>
              </div>

              <div className="mt-6 flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 px-4 py-2.5 rounded-full glass">Batal</button>
                <button onClick={doUnlock} disabled={unlocking}
                  className="flex-1 px-4 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : needsAction === "vip-unlock" ? "Unlock Sekarang" : "Ya, buka"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIP gate modal */}
      <AnimatePresence>
        {vipGateOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl bg-background text-foreground p-6 shadow-2xl">
              <div className="text-center">
                <Crown className="mx-auto h-10 w-10 text-vip" />
                <h3 className="mt-3 font-display text-xl font-semibold">Story ini hanya untuk VIP</h3>
                <p className="mt-2 text-sm text-muted-foreground">Upgrade ke VIP untuk membaca cerita ini dan menikmati semua keuntungan eksklusif.</p>
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => { setVipGateOpen(false); navigate({ to: "/story/$slug", params: { slug: story?.slug ?? "" } }); }} className="flex-1 px-4 py-2.5 rounded-full glass">Batal</button>
                <button onClick={() => navigate({ to: "/wallet" })}
                  className="flex-1 px-4 py-2.5 rounded-full bg-gradient-to-r from-vip to-gold text-white font-medium inline-flex items-center justify-center gap-2">
                  <Crown className="h-4 w-4" /> Upgrade VIP
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChapterLikeButton({ chapterId, activeBg, activeFg }: { chapterId: string; activeBg: string; activeFg: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const likeQ = useQuery({
    queryKey: ["chapter-like", chapterId, user?.id ?? null],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("chapter_likes").select("*", { count: "exact", head: true }).eq("chapter_id", chapterId),
        user
          ? supabase.from("chapter_likes").select("chapter_id").eq("chapter_id", chapterId).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const likeM = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("toggle_chapter_like", { _chapter_id: chapterId });
      if (error) throw error;
      return data as { liked: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-like", chapterId] });
      qc.invalidateQueries({ queryKey: ["story"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const liked = !!likeQ.data?.liked;
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => { if (!user) { toast.error("Login dulu untuk like."); navigate({ to: "/login" }); return; } likeM.mutate(); }}
        disabled={likeM.isPending}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition"
        style={{ backgroundColor: liked ? activeFg : "transparent", color: liked ? activeBg : activeFg, border: `1px solid ${activeFg}55` }}
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likeQ.data?.count ?? 0}
        <span className="opacity-70">{liked ? "Liked" : "Like"}</span>
      </button>
    </div>
  );
}
