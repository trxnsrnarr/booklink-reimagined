import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PenLine, Plus, Eye, Heart, BookOpen, Crown, FileText, TrendingUp, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { supabase } from "@/integrations/supabase/client";
import { GENRES, formatNumber } from "@/lib/types";

export const Route = createFileRoute("/write")({ component: WritePage });

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || `story-${Date.now()}`
  );
}

type Tab = "all" | "draft" | "published";

function WritePage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("romance");
  const [synopsis, setSynopsis] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const myStoriesQ = useQuery({
    enabled: !!user,
    queryKey: ["my-stories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*, chapters(count)")
        .eq("author_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stories = myStoriesQ.data ?? [];
  const filtered = useMemo(() => {
    return stories.filter((s) => {
      if (tab !== "all" && s.status !== tab) return false;
      if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [stories, tab, search]);

  const totals = useMemo(() => {
    const acc = { stories: stories.length, views: 0, likes: 0, published: 0 };
    for (const s of stories) {
      acc.views += s.views ?? 0;
      acc.likes += s.likes_count ?? 0;
      if (s.status === "published") acc.published += 1;
    }
    return acc;
  }, [stories]);

  const createStory = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      if (!title.trim()) throw new Error("title");
      const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .from("stories")
        .insert({
          author_id: user.id,
          author_name: user.email?.split("@")[0] ?? "Author",
          title: title.trim(),
          slug,
          synopsis: synopsis.trim() || null,
          genre,
          status: "draft",
          cover_gradient: "linear-gradient(135deg, #d2b48c, #a0522d)",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Cerita dibuat!");
      setTitle("");
      setSynopsis("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["my-stories"] });
    },
    onError: (e: Error) => toast.error(e.message === "title" ? "Judul wajib diisi." : "Gagal membuat cerita."),
  });

  if (loading)
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <PenLine className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("nav.write")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Login untuk mulai menulis.</p>
        <Link
          to="/login"
          className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow"
        >
          {t("nav.login")}
        </Link>
      </div>
    );
  }

  const statCards = [
    { icon: BookOpen, label: "Cerita", value: totals.stories },
    { icon: Sparkles, label: "Published", value: totals.published },
    { icon: Eye, label: "Total Views", value: formatNumber(totals.views) },
    { icon: Heart, label: "Total Likes", value: formatNumber(totals.likes) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Creator Studio
          </p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl font-semibold">{t("nav.write")}</h1>
          <p className="mt-2 text-muted-foreground">Kelola, tulis, dan terbitkan karyamu.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow hover:shadow-warm transition-all"
        >
          <Plus className="h-4 w-4" /> {t("editor.newStory")}
        </button>
      </motion.div>

      {/* New story form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 glass-strong rounded-2xl p-6 space-y-4 overflow-hidden"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("editor.title")}
            className="w-full px-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40"
          />
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-background text-foreground border border-border outline-none focus:ring-2 focus:ring-primary/40"
          >
            {GENRES.filter((g) => g.value !== "all").map((g) => (
              <option key={g.value} value={g.value} className="bg-background text-foreground">
                {g.label}
              </option>
            ))}
          </select>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder={t("editor.synopsis")}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full glass text-sm">
              {t("common.cancel")}
            </button>
            <button
              onClick={() => createStory.mutate()}
              disabled={createStory.isPending}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {createStory.isPending ? "..." : t("common.save")}
            </button>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <div className="flex glass rounded-full p-1 text-sm">
          {(["all", "draft", "published"] as Tab[]).map((tt) => (
            <button
              key={tt}
              onClick={() => setTab(tt)}
              className={`px-4 py-1.5 rounded-full transition ${tab === tt ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tt === "all" ? "Semua" : tt === "draft" ? "Draft" : "Published"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul..."
            className="w-full pl-9 pr-4 py-2 rounded-full bg-input/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {myStoriesQ.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="glass-strong rounded-3xl p-12 text-center">
            <PenLine className="mx-auto h-12 w-12 text-primary" />
            <h3 className="mt-4 font-display text-xl font-semibold">
              {stories.length === 0 ? "Mulai cerita pertamamu" : "Tidak ada cerita cocok"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {stories.length === 0 ? "Klik tombol di atas untuk membuat cerita baru." : "Ubah filter atau pencarian."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filtered.map((s, i) => {
              const chapterCount = Array.isArray(s.chapters) ? (s.chapters[0]?.count ?? 0) : 0;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link
                    to="/write/$storyId"
                    params={{ storyId: s.id }}
                    className="group block rounded-2xl overflow-hidden glass-strong hover-lift transition-all hover:shadow-warm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    <div
                      className="relative aspect-[3/4] overflow-hidden"
                      style={{ background: s.cover_gradient ?? "var(--gradient-warm)" }}
                    >
                      {s.cover_url && (
                        <img
                          src={s.cover_url}
                          alt={s.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
                        {s.is_vip ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-vip/90 text-white text-[10px] font-bold uppercase tracking-wider">
                            <Crown className="h-3 w-3" /> VIP
                          </span>
                        ) : s.is_premium ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/90 text-foreground text-[10px] font-bold uppercase tracking-wider">
                            Premium
                          </span>
                        ) : (
                          <span />
                        )}
                        {s.status === "draft" && (
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold uppercase tracking-wider">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                        <p className="text-[10px] uppercase tracking-widest opacity-80">{s.genre}</p>
                        <h3 className="font-display text-base font-semibold leading-tight line-clamp-2 drop-shadow">
                          {s.title}
                        </h3>
                      </div>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-primary/10 mix-blend-overlay" />
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {chapterCount} ch
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {formatNumber(s.views ?? 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {formatNumber(s.likes_count ?? 0)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 truncate">
                        Update:{" "}
                        {new Date(s.updated_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats - moved below the story list */}
      <div className="mt-16 sm:mt-20">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-widest text-primary font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Ringkasan
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Total Statistik</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass-strong rounded-2xl p-5"
            >
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-2xl sm:text-3xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
