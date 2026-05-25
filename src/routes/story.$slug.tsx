import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Eye, Heart, MessageCircle, BookOpen, Crown, Star, Plus, Pencil, Lock, Gem } from "lucide-react";
import { toast } from "sonner";
import { fetchStoryBySlug, fetchChapters } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { toggleFavorite, isFavorited, isFollowing, toggleFollow } from "@/lib/economy.functions";
import { AddToLibraryModal } from "@/components/AddToLibraryModal";
import { Comments } from "@/components/Comments";

export const Route = createFileRoute("/story/$slug")({
  component: StoryDetail,
});

function StoryDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const qc = useQueryClient();
  const [libOpen, setLibOpen] = useState(false);

  const storyQ = useQuery({
    queryKey: ["story", slug],
    queryFn: async () => {
      const s = await fetchStoryBySlug(slug);
      if (!s) throw notFound();
      return s;
    },
  });
  const chaptersQ = useQuery({
    queryKey: ["chapters", storyQ.data?.id],
    queryFn: () => fetchChapters(storyQ.data!.id),
    enabled: !!storyQ.data?.id,
  });

  const progressQ = useQuery({
    enabled: !!user && !!storyQ.data?.id,
    queryKey: ["reading-progress", storyQ.data?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reading_progress")
        .select("chapter_id, updated_at")
        .eq("user_id", user!.id)
        .eq("story_id", storyQ.data!.id)
        .maybeSingle();
      return data as { chapter_id: string; updated_at: string } | null;
    },
  });

  const favCheck = useServerFn(isFavorited);
  const favToggle = useServerFn(toggleFavorite);
  const followCheck = useServerFn(isFollowing);
  const followToggle = useServerFn(toggleFollow);

  const favQ = useQuery({
    enabled: !!user && !!storyQ.data?.id,
    queryKey: ["fav", storyQ.data?.id],
    queryFn: () => favCheck({ data: { story_id: storyQ.data!.id } }),
  });
  const followQ = useQuery({
    enabled: !!user && !!storyQ.data?.author_id && storyQ.data?.author_id !== user?.id,
    queryKey: ["follow", storyQ.data?.author_id],
    queryFn: () => followCheck({ data: { following_id: storyQ.data!.author_id! } }),
  });

  const favM = useMutation({
    mutationFn: () => favToggle({ data: { story_id: storyQ.data!.id } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["fav", storyQ.data?.id] }); toast.success(r.favorited ? "Ditambahkan ke favorit." : "Dihapus dari favorit."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const followM = useMutation({
    mutationFn: () => followToggle({ data: { following_id: storyQ.data!.author_id! } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["follow", storyQ.data?.author_id] }); toast.success(r.following ? "Sekarang follow author." : "Berhenti follow."); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (storyQ.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="grid md:grid-cols-[280px_1fr] gap-8">
          <div className="skeleton aspect-[3/4] rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton h-10 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (storyQ.isError || !storyQ.data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cerita tidak ditemukan.</p>
        <Link to="/explore" className="mt-4 inline-block text-primary">Kembali ke Explore</Link>
      </div>
    );
  }

  const story = storyQ.data;
  const requireLogin = (label: string) => {
    if (!user) { toast.error(`Login dulu untuk ${label}.`); return false; }
    return true;
  };
  const isAuthor = user && story.author_id === user.id;
  const favorited = favQ.data?.favorited;
  const following = followQ.data?.following;

  return (
    <div className="relative">
      {/* Blurred backdrop using cover */}
      <div className="absolute inset-x-0 top-0 h-[480px] overflow-hidden -z-10 pointer-events-none">
        <div
          className="absolute inset-0 scale-110"
          style={{ background: story.cover_gradient ?? "var(--gradient-warm)" }}
        />
        {story.cover_url && (
          <img
            src={story.cover_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover scale-110 blur-3xl opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Medium cover */}
        <div
          className="aspect-[3/4] rounded-2xl shadow-warm overflow-hidden relative ring-1 ring-border/40"
          style={{ background: story.cover_gradient ?? "var(--gradient-warm)" }}
        >
          {story.cover_url && (
            <img
              src={story.cover_url}
              alt={story.title}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-0 p-5 flex flex-col justify-between text-white">
            <div className="flex gap-2">
              {story.is_vip && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-vip text-white text-[10px] font-bold uppercase tracking-wider">
                  <Crown className="h-3 w-3" /> VIP
                </span>
              )}
              {!story.is_vip && story.is_premium && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold text-foreground text-[10px] font-bold uppercase tracking-wider">
                  Premium
                </span>
              )}
            </div>
            <div className="drop-shadow-lg">
              <p className="text-[10px] uppercase tracking-widest opacity-80">{story.genre}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">{story.title}</h2>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-medium">{story.genre}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight">{story.title}</h1>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center font-semibold">
              {story.author_avatar ?? story.author_name[0]}
            </div>
            <div>
              <p className="font-semibold text-sm">{story.author_name}</p>
              {!isAuthor && (
                <button
                  disabled={followM.isPending}
                  onClick={() => { if (requireLogin("follow")) followM.mutate(); }}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {following ? "✓ Following" : "+ Follow"}
                </button>
              )}
            </div>
          </div>

          {story.synopsis && (
            <p className="mt-6 text-muted-foreground leading-relaxed">{story.synopsis}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> {formatNumber(story.views)} views</span>
            <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" /> {formatNumber(story.likes_count)} likes</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {formatNumber(story.comments_count)} comments</span>
            <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4" /> {formatNumber(story.favorite_count)} favorites</span>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {isAuthor ? (
              <button
                onClick={() => navigate({ to: "/write/$storyId", params: { storyId: story.id } })}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow hover:shadow-warm transition-all"
              >
                <Pencil className="h-4 w-4" /> Edit Story
              </button>
            ) : progressQ.data?.chapter_id ? (
              <button
                onClick={() => navigate({ to: "/read/$chapterId", params: { chapterId: progressQ.data!.chapter_id } })}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow hover:shadow-warm transition-all"
              >
                <BookOpen className="h-4 w-4" /> Lanjutkan Membaca
              </button>
            ) : (
              <button
                onClick={() => {
                  const first = chaptersQ.data?.[0];
                  if (first) navigate({ to: "/read/$chapterId", params: { chapterId: first.id } });
                  else toast.info("Belum ada chapter tersedia.");
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow hover:shadow-warm transition-all"
              >
                <BookOpen className="h-4 w-4" /> Baca Buku
              </button>
            )}
            {!isAuthor && (
              <>
                <button
                  disabled={favM.isPending}
                  onClick={() => { if (requireLogin("favorite")) favM.mutate(); }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition ${favorited ? "bg-primary/15 text-primary border border-primary/30" : "glass-strong hover:bg-accent/50"}`}
                >
                  <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} /> {favorited ? "Favorited" : "Favorite"}
                </button>
                <button
                  onClick={() => { if (requireLogin("library")) setLibOpen(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full glass-strong text-sm hover:bg-accent/50"
                >
                  <Plus className="h-4 w-4" /> Library
                </button>
              </>
            )}
            {story.is_vip && (
              <span className="inline-flex items-center gap-1 px-3 py-2.5 rounded-full bg-vip/15 text-vip text-xs font-semibold">
                <Lock className="h-3.5 w-3.5" /> VIP only
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Chapters */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold mb-4">Chapters</h2>
        {chaptersQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : !chaptersQ.data?.length ? (
          <p className="text-muted-foreground glass rounded-xl p-6 text-sm">Belum ada chapter.</p>
        ) : (
          <ul className="space-y-2">
            {chaptersQ.data.map((c) => (
              <ChapterRow key={c.id} chapter={c} storyId={story.id} requireLogin={requireLogin} />
            ))}
          </ul>
        )}
      </section>

      <Comments storyId={story.id} />
      </div>
      {user && <AddToLibraryModal storyId={story.id} open={libOpen} onClose={() => setLibOpen(false)} />}
    </div>
  );
}

function ChapterRow({ chapter: c, storyId, requireLogin }: { chapter: any; storyId: string; requireLogin: (l: string) => boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const likeQ = useQuery({
    queryKey: ["chapter-like", c.id, user?.id ?? null],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("chapter_likes").select("*", { count: "exact", head: true }).eq("chapter_id", c.id),
        user
          ? supabase.from("chapter_likes").select("chapter_id").eq("chapter_id", c.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const likeM = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("toggle_chapter_like", { _chapter_id: c.id });
      if (error) throw error;
      return data as { liked: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-like", c.id] });
      qc.invalidateQueries({ queryKey: ["story"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className={`glass rounded-xl p-4 transition-all flex items-center justify-between gap-3 ${c.is_premium ? "ring-1 ring-gold/40 bg-gold/5" : ""}`}>
      <Link to="/read/$chapterId" params={{ chapterId: c.id }} className="flex-1 min-w-0 hover:opacity-80">
        <p className="font-medium inline-flex items-center gap-1.5">{c.order_index}. {c.title} {c.is_premium && <Gem className="h-3.5 w-3.5 text-gold" />}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{c.word_count} kata · {formatNumber(c.reader_count)} pembaca{c.is_premium ? " · Premium • 10 Coin" : " · Gratis"}</p>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); if (requireLogin("like chapter")) likeM.mutate(); }}
        disabled={likeM.isPending}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${likeQ.data?.liked ? "bg-primary/15 text-primary" : "glass hover:bg-accent/50"}`}
      >
        <Heart className={`h-3.5 w-3.5 ${likeQ.data?.liked ? "fill-current" : ""}`} /> {likeQ.data?.count ?? 0}
      </button>
      {c.is_premium && <span className="inline-flex items-center gap-1 rounded-full bg-gold/90 text-foreground px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"><Lock className="h-3 w-3" /> Premium</span>}
    </li>
  );
}

