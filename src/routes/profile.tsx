import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Coins, User as UserIcon, Users, Sparkles, Eye, Heart, BookOpen, Plus, Crown, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyAuthorStats } from "@/lib/economy.functions";
import { StoryCard } from "@/components/StoryCard";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const fetchStats = useServerFn(getMyAuthorStats);
  const statsQ = useQuery({ enabled: !!user, queryKey: ["my-author-stats"], queryFn: () => fetchStats() });

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="skeleton h-32 rounded-2xl" /></div>;
  if (!user || !profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <UserIcon className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Profil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Login untuk melihat profilmu.</p>
        <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow">Login</Link>
      </div>
    );
  }

  const stats = statsQ.data?.stats ?? { views: 0, likes: 0, unlocks: 0, followers: 0, following: 0 };
  const stories = statsQ.data?.stories ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8 shadow-warm">
        <div className="flex items-center gap-5 flex-wrap">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="h-20 w-20 rounded-full object-cover shadow-glow" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-glow">
              {(profile.display_name ?? profile.username)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-semibold inline-flex items-center gap-2">
              {profile.display_name ?? profile.username}
              {profile.vip_until && new Date(profile.vip_until) > new Date() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-vip text-white text-xs font-bold"><Crown className="h-3.5 w-3.5" /> VIP</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            <p className="text-xs text-muted-foreground mt-1">Bergabung {new Date(profile.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</p>
          </div>
          <Link to="/u/$username" params={{ username: profile.username }} className="px-4 py-2 rounded-full glass text-sm">Lihat publik →</Link>
        </div>

        {profile.bio && <p className="mt-6 text-muted-foreground">{profile.bio}</p>}

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Coins, label: "Coins", value: profile.coin_balance },
            { icon: Eye, label: "Total Views", value: stats.views },
            { icon: Heart, label: "Total Likes", value: stats.likes },
            { icon: Users, label: "Followers", value: stats.followers },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-4 text-center">
              <s.icon className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-2 font-display text-2xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Karya Saya</h2>
          <Link to="/write" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium shadow-glow"><Plus className="h-4 w-4" />Cerita baru</Link>
        </div>
        {statsQ.isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="skeleton h-40 rounded-2xl"/>)}</div>
        ) : stories.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-10 w-10 text-primary mb-2" />
            <p>Belum ada cerita. <Link to="/write" className="text-primary">Mulai menulis →</Link></p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {stories.map((s: any, i: number) => {
              const isPublished = s.status === "published";
              const story = {
                id: s.id, title: s.title, slug: s.slug, genre: s.genre,
                views: s.views ?? 0, likes_count: s.likes_count ?? 0,
                cover_gradient: s.cover_gradient ?? null, cover_url: s.cover_url ?? null,
                author_id: profile.id, author_name: profile.display_name ?? profile.username, author_avatar: profile.avatar_url ?? null,
                synopsis: null, tags: null, status: s.status,
                is_premium: !!s.is_premium, is_vip: !!s.is_vip, is_trending: !!s.is_trending, is_recommended: false,
                comments_count: 0, unlock_count: s.unlock_count ?? 0, favorite_count: 0,
                created_at: s.created_at ?? "",
              };
              return (
                <div key={s.id} className="relative group">
                  {isPublished ? (
                    <StoryCard story={story} index={i} />
                  ) : (
                    <Link to="/write/$storyId" params={{ storyId: s.id }} className="group block relative rounded-2xl overflow-hidden hover-lift">
                      <div className="relative aspect-[3/4] w-full overflow-hidden" style={{ background: s.cover_gradient ?? "var(--gradient-warm)" }}>
                        {s.cover_url && <img src={s.cover_url} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground uppercase">{s.status}</span>
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                          <p className="text-[10px] uppercase tracking-widest opacity-80">{s.genre}</p>
                          <h3 className="mt-1 font-display text-lg leading-tight font-semibold line-clamp-3">{s.title}</h3>
                        </div>
                      </div>
                      <div className="p-3 text-xs text-muted-foreground inline-flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Edit draft</div>
                    </Link>
                  )}
                  <Link to="/write/$storyId" params={{ storyId: s.id }} aria-label="Edit" className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
