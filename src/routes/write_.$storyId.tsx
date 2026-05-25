import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Crown, Eye, Send, BookOpen, Info, Save, GripVertical, Sparkles, ExternalLink, CreditCard, CheckCircle2, Coins, Gem, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ImageUploader } from "@/components/ImageUploader";
import { RichEditor } from "@/components/RichEditor";
import { GENRES } from "@/lib/types";

export const Route = createFileRoute("/write_/$storyId")({ component: StoryEditor });

type Tab = "info" | "chapters";

function StoryEditor() {
  const { storyId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("info");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [showChapterForm, setShowChapterForm] = useState(false);

  // Story info form state
  const [infoTitle, setInfoTitle] = useState("");
  const [infoSynopsis, setInfoSynopsis] = useState("");
  const [infoGenre, setInfoGenre] = useState("romance");
  const [infoTags, setInfoTags] = useState("");
  const [infoIsVip, setInfoIsVip] = useState(false);

  const storyQ = useQuery({
    queryKey: ["edit-story", storyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stories").select("*").eq("id", storyId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const chaptersQ = useQuery({
    queryKey: ["edit-chapters", storyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*").eq("story_id", storyId).order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sync local info state when story loads
  useEffect(() => {
    const s = storyQ.data;
    if (!s) return;
    setInfoTitle(s.title ?? "");
    setInfoSynopsis(s.synopsis ?? "");
    setInfoGenre(s.genre ?? "romance");
    setInfoTags((s.tags ?? []).join(", "));
    setInfoIsVip(!!s.is_vip);
  }, [storyQ.data]);

  const saveInfo = useMutation({
    mutationFn: async () => {
      if (!infoTitle.trim()) throw new Error("title");
      const tags = infoTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
      const { error } = await supabase.from("stories").update({
        title: infoTitle.trim(),
        synopsis: infoSynopsis.trim() || null,
        genre: infoGenre,
        tags,
        is_premium: false,
        is_vip: infoIsVip,
      }).eq("id", storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Detail cerita disimpan.");
      qc.invalidateQueries({ queryKey: ["edit-story", storyId] });
      qc.invalidateQueries({ queryKey: ["my-stories"] });
    },
    onError: (e: Error) => toast.error(e.message === "title" ? "Judul wajib diisi." : "Gagal menyimpan."),
  });

  const saveChapter = useMutation({
    mutationFn: async () => {
      if (!chapterTitle.trim()) throw new Error("title");
      const words = chapterContent.trim().split(/\s+/).filter(Boolean).length;
      // Only allow is_premium=true if author has already paid for THIS chapter.
      let allowPremium = false;
      let chapterIdForPayment: string | null = editingId;
      if (editingId) {
        const cur = (chaptersQ.data ?? []).find((c) => c.id === editingId);
        allowPremium = cur?.chapter_payment_status === "success";
      }
      const effectivePremium = isPremium && allowPremium;
      if (editingId) {
        const { error } = await supabase.from("chapters").update({
          title: chapterTitle, content: chapterContent, is_premium: effectivePremium, word_count: words,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const order = (chaptersQ.data?.length ?? 0) + 1;
        const { data: inserted, error } = await supabase.from("chapters").insert({
          story_id: storyId, title: chapterTitle, content: chapterContent, order_index: order, is_premium: false, word_count: words,
        }).select("id").single();
        if (error) throw error;
        if (!inserted) throw new Error("insert_failed");
        chapterIdForPayment = inserted.id;
      }
      return { wantedPremium: isPremium, gotPremium: effectivePremium, chapterIdForPayment };
    },
    onSuccess: (r) => {
      if (r.wantedPremium && !r.gotPremium) {
        toast.success("Chapter tersimpan. Lanjutkan pembayaran untuk mengaktifkan Premium • 10 Coin.");
        if (r.chapterIdForPayment) {
          navigate({ to: "/checkout/chapter-paid/$chapterId", params: { chapterId: r.chapterIdForPayment } });
        }
      } else {
        toast.success("Chapter tersimpan!");
      }
      setEditingId(null); setChapterTitle(""); setChapterContent(""); setIsPremium(false); setShowChapterForm(false);
      qc.invalidateQueries({ queryKey: ["edit-chapters", storyId] });
    },
    onError: (e: Error) => toast.error(e.message === "title" ? "Judul chapter wajib diisi." : "Gagal menyimpan."),
  });

  const deleteChapter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Chapter dihapus."); qc.invalidateQueries({ queryKey: ["edit-chapters", storyId] }); },
  });

  const reorderChapter = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const list = chaptersQ.data ?? [];
      const idx = list.findIndex((c) => c.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      const a = list[idx];
      await supabase.from("chapters").update({ order_index: swap.order_index }).eq("id", a.id);
      await supabase.from("chapters").update({ order_index: a.order_index }).eq("id", swap.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edit-chapters", storyId] }),
  });

  const publishStory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stories").update({ status: "published" }).eq("id", storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cerita diterbitkan! 🎉");
      qc.invalidateQueries({ queryKey: ["edit-story", storyId] });
      qc.invalidateQueries({ queryKey: ["my-stories"] });
    },
  });

  const unpublishStory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stories").update({ status: "draft" }).eq("id", storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cerita disembunyikan ke draft.");
      qc.invalidateQueries({ queryKey: ["edit-story", storyId] });
      qc.invalidateQueries({ queryKey: ["my-stories"] });
    },
  });

  const updateCover = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.from("stories").update({ cover_url: url || null }).eq("id", storyId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cover diperbarui."); qc.invalidateQueries({ queryKey: ["edit-story", storyId] }); },
  });





  if (storyQ.isLoading) return <div className="mx-auto max-w-4xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!storyQ.data || storyQ.data.author_id !== user?.id) {
    return <div className="text-center py-20 text-muted-foreground">Akses ditolak. <Link to="/write" className="text-primary">Kembali</Link></div>;
  }

  const story = storyQ.data;
  const startEdit = (c: { id: string; title: string; content: string; is_premium: boolean }) => {
    setEditingId(c.id); setChapterTitle(c.title); setChapterContent(c.content); setIsPremium(c.is_premium);
    setShowChapterForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => { setEditingId(null); setChapterTitle(""); setChapterContent(""); setIsPremium(false); setShowChapterForm(false); };
  const startNew = () => { cancelEdit(); setShowChapterForm(true); setTimeout(() => window.scrollTo({ top: 300, behavior: "smooth" }), 50); };

  const chapters = chaptersQ.data ?? [];
  const totalWords = chapters.reduce((acc, c) => acc + (c.word_count ?? 0), 0);
  const premiumChapters = chapters.filter((c) => c.is_premium).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <button onClick={() => navigate({ to: "/write" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Studio
        </button>
        {story.status === "published" && (
          <Link to="/story/$slug" params={{ slug: story.slug }} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Lihat halaman publik
          </Link>
        )}
      </div>

      {/* Hero header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 sm:p-8 shadow-warm">
        <div className="grid sm:grid-cols-[200px_1fr] gap-6">
          <div className="w-full max-w-[200px] mx-auto sm:mx-0">
            {user && (
              <ImageUploader
                bucket="covers"
                userId={user.id}
                pathPrefix={storyId}
                aspect="portrait"
                value={story.cover_url}
                onUploaded={(url) => updateCover.mutate(url)}
              />
            )}
            <p className="mt-2 text-[11px] text-muted-foreground text-center">Cover 2:3 · maks 10MB</p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${story.status === "published" ? "bg-primary/90 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {story.status === "published" ? "Live" : "Draft"}
              </span>
              <span className="text-xs uppercase tracking-widest text-primary font-medium">{story.genre}</span>
              {story.is_vip && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-vip/90 text-white text-[10px] font-bold uppercase"><Crown className="h-3 w-3" /> VIP</span>}
              {story.is_premium && !story.is_vip && <span className="px-2 py-0.5 rounded-full bg-gold/90 text-foreground text-[10px] font-bold uppercase">Premium</span>}
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold leading-tight">{story.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{story.synopsis ?? "—"}</p>

            {/* Stat strip */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="glass rounded-xl p-3"><p className="text-muted-foreground">Chapter</p><p className="font-display text-lg font-semibold">{chapters.length}</p></div>
              <div className="glass rounded-xl p-3"><p className="text-muted-foreground">Kata</p><p className="font-display text-lg font-semibold">{totalWords.toLocaleString("id-ID")}</p></div>
              <div className="glass rounded-xl p-3"><p className="text-muted-foreground inline-flex items-center gap-1"><Eye className="h-3 w-3" />Views</p><p className="font-display text-lg font-semibold">{story.views}</p></div>
              <div className="glass rounded-xl p-3"><p className="text-muted-foreground">Unlock</p><p className="font-display text-lg font-semibold">{story.unlock_count ?? 0}</p></div>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              {story.status !== "published" ? (
                (() => {
                  const vipUnpaid = story.is_vip && story.vip_payment_status !== "success";
                  const noChapters = !chapters.length;
                  const blocked = vipUnpaid || noChapters;
                  const title = noChapters ? "Tambahkan minimal 1 chapter" : vipUnpaid ? "Bayar aktivasi VIP dulu" : "";
                  return (
                    <button onClick={() => publishStory.mutate()} disabled={publishStory.isPending || blocked} title={title} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-60 disabled:cursor-not-allowed">
                      <Send className="h-4 w-4" /> {publishStory.isPending ? "..." : vipUnpaid ? "Bayar dulu" : "Publish"}
                    </button>
                  );
                })()
              ) : (
                <button onClick={() => { if (confirm("Sembunyikan cerita ini ke draft?")) unpublishStory.mutate(); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm">
                  Unpublish
                </button>
              )}
              <button onClick={() => { setTab("chapters"); startNew(); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm hover:bg-accent/40">
                <Plus className="h-4 w-4" /> Chapter baru
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="mt-6 flex glass rounded-full p-1 text-sm w-fit">
        {([
          { k: "info", l: "Info Cerita", I: Info },
          { k: "chapters", l: `Chapter (${chapters.length})`, I: BookOpen },
        ] as const).map(({ k, l, I }) => (
          <button key={k} onClick={() => setTab(k as Tab)} className={`px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 transition ${tab === k ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}>
            <I className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 glass-strong rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Detail Cerita</h2>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul</label>
            <input value={infoTitle} onChange={(e) => setInfoTitle(e.target.value)} placeholder="Judul cerita" className="mt-1 w-full px-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sinopsis</label>
            <textarea value={infoSynopsis} onChange={(e) => setInfoSynopsis(e.target.value)} rows={4} placeholder="Ceritakan singkat tentang kisah kamu..." className="mt-1 w-full px-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
            <p className="mt-1 text-[11px] text-muted-foreground">{infoSynopsis.length} karakter</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Genre</label>
              <select value={infoGenre} onChange={(e) => setInfoGenre(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-background text-foreground border border-border outline-none focus:ring-2 focus:ring-primary/40">
                {GENRES.filter((g) => g.value !== "all").map((g) => <option key={g.value} value={g.value} className="bg-background text-foreground">{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tags (pisahkan dengan koma)</label>
              <input value={infoTags} onChange={(e) => setInfoTags(e.target.value)} placeholder="cinta, sekolah, sedih" className="mt-1 w-full px-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div className="flex gap-4 flex-wrap text-sm pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={infoIsVip} onChange={(e) => setInfoIsVip(e.target.checked)} />
              <Crown className="h-4 w-4 text-vip" /> Hanya untuk VIP
            </label>
          </div>

          {/* VIP story payment status */}
          {infoIsVip && (
            <div className={`rounded-2xl p-4 ring-1 ${story.vip_payment_status === "success" ? "ring-primary/40 bg-primary/5" : "ring-vip/40 bg-vip/5"}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <Crown className="h-5 w-5 text-vip shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Aktivasi cerita VIP — Rp 15.000 (sekali bayar)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {story.vip_payment_status === "success"
                      ? "Pembayaran berhasil. Cerita ini boleh dipublish sebagai VIP."
                      : "Bayar dulu untuk bisa publish cerita ini sebagai VIP."}
                  </p>
                </div>
                {story.vip_payment_status === "success" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Lunas</span>
                ) : (
                  <Link to="/checkout/story-vip/$storyId" params={{ storyId }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vip text-white text-sm font-semibold shadow-glow">
                    <CreditCard className="h-4 w-4" /> Bayar Rp 15.000
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={() => saveInfo.mutate()} disabled={saveInfo.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-60">
              <Save className="h-4 w-4" /> {saveInfo.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </motion.section>
      )}

      {tab === "chapters" && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-6">
          {/* Chapter list */}
          <div className="glass-strong rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div>
                <h2 className="font-display text-xl font-semibold">Daftar Chapter</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{chapters.length} chapter · {premiumChapters} premium · {totalWords.toLocaleString("id-ID")} kata</p>
              </div>
              {!showChapterForm && (
                <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium shadow-glow">
                  <Plus className="h-4 w-4" /> Tambah
                </button>
              )}
            </div>
            <div className="space-y-2">
              {chaptersQ.isLoading ? <div className="skeleton h-14 rounded-xl" /> :
                !chapters.length ? <p className="glass rounded-xl p-8 text-sm text-muted-foreground text-center">Belum ada chapter. Klik "Tambah" untuk mulai menulis.</p> :
                chapters.map((c, i) => {
                  const premiumActive = c.is_premium || c.chapter_payment_status === "success";
                  return (
                  <div key={c.id} className={`glass rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition ${premiumActive ? "ring-1 ring-gold/40 bg-gold/5" : ""} ${editingId === c.id ? "ring-2 ring-primary/60" : "hover:bg-accent/20"}`}>
                    <div className="flex flex-col text-muted-foreground">
                      <button disabled={i === 0} onClick={() => reorderChapter.mutate({ id: c.id, dir: -1 })} className="hover:text-foreground disabled:opacity-30 text-xs leading-none">▲</button>
                      <GripVertical className="h-3 w-3 my-0.5 opacity-50" />
                      <button disabled={i === chapters.length - 1} onClick={() => reorderChapter.mutate({ id: c.id, dir: 1 })} className="hover:text-foreground disabled:opacity-30 text-xs leading-none">▼</button>
                    </div>
                    <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground text-sm font-bold shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate flex items-center gap-1.5">{c.title} {premiumActive && <Gem className="h-3.5 w-3.5 text-gold shrink-0" />}</p>
                      <p className="text-xs text-muted-foreground">{(c.word_count ?? 0).toLocaleString("id-ID")} kata · {c.reader_count ?? 0} pembaca</p>
                    </div>
                    {premiumActive ? (
                      <span className="px-3 py-1.5 rounded-full text-[11px] bg-gold/90 text-foreground font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                        <LockKeyhole className="h-3 w-3" /> Premium • 10 Coin
                      </span>
                    ) : c.chapter_payment_status !== "success" && (
                      <Link to="/checkout/chapter-paid/$chapterId" params={{ chapterId: c.id }} className="px-3 py-1.5 rounded-full text-[11px] bg-gold/15 text-gold border border-gold/40 font-semibold inline-flex items-center gap-1 whitespace-nowrap" title="Bayar Rp 2.000 untuk aktifkan Premium • 10 Coin">
                        <CreditCard className="h-3 w-3" /> Jadikan Premium
                      </Link>
                    )}
                    <button onClick={() => startEdit(c)} className="px-3 py-1.5 rounded-full text-xs glass hover:bg-accent/50">Edit</button>
                    <button onClick={() => { if (confirm("Hapus chapter ini?")) deleteChapter.mutate(c.id); }} className="p-2 rounded-full text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )})
              }
            </div>
          </div>

          {/* Chapter editor */}
          {showChapterForm && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">{editingId ? "Edit Chapter" : "Chapter Baru"}</h2>
                <button onClick={cancelEdit} className="text-sm text-muted-foreground hover:text-foreground">Tutup</button>
              </div>
              <input value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="Judul chapter" className="w-full px-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40 font-display text-lg" />
              {user && (
                <RichEditor
                  value={chapterContent}
                  onChange={setChapterContent}
                  userId={user.id}
                  placeholder="Tulis cerita kamu di sini... Sisipkan gambar di posisi mana saja."
                />
              )}
              <div className="grid sm:grid-cols-2 gap-3 text-sm pt-1">
                <button type="button" onClick={() => setIsPremium(false)} className={`text-left rounded-2xl p-4 border transition ${!isPremium ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border glass hover:bg-accent/30"}`}>
                  <span className="inline-flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" /> Gratis</span>
                  <span className="block text-xs text-muted-foreground mt-1">Semua pembaca bisa membaca chapter ini.</span>
                </button>
                <button type="button" onClick={() => setIsPremium(true)} className={`text-left rounded-2xl p-4 border transition ${isPremium ? "border-gold bg-gold/10 ring-2 ring-gold/30" : "border-border glass hover:bg-accent/30"}`}>
                  <span className="inline-flex items-center gap-2 font-semibold"><Gem className="h-4 w-4 text-gold" /> Premium (10 Coin)</span>
                  <span className="block text-xs text-muted-foreground mt-1">Author bayar aktivasi dulu, lalu chapter otomatis premium & publish.</span>
                </button>
              </div>
              <div className="flex items-center gap-4 flex-wrap text-sm pt-1">
                {isPremium && (
                  <div className="w-full rounded-2xl p-4 border border-gold/40 bg-gold/5 flex items-start gap-3">
                    <Coins className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Aktivasi Premium Chapter — Rp 2.000</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Setelah menyimpan, kamu akan diarahkan ke halaman checkout seperti flow VIP Story. Setelah sukses, chapter otomatis menjadi <strong>Premium • 10 Coin</strong>.</p>
                    </div>
                    {editingId && (chaptersQ.data ?? []).find((c) => c.id === editingId)?.chapter_payment_status === "success" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Lunas</span>
                    )}
                  </div>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{chapterContent.replace(/<[^>]*>/g, "").trim().split(/\s+/).filter(Boolean).length} kata</span>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button onClick={cancelEdit} className="px-4 py-2 rounded-full glass text-sm">Batal</button>
                <button onClick={() => saveChapter.mutate()} disabled={saveChapter.isPending} className="px-5 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium disabled:opacity-60 inline-flex items-center gap-1.5">
                  <Save className="h-4 w-4" /> {saveChapter.isPending ? "..." : editingId ? "Update Chapter" : "Tambah Chapter"}
                </button>
              </div>
            </motion.div>
          )}
        </motion.section>
      )}
    </div>
  );
}
