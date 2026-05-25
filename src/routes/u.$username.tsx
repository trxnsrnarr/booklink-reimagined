import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Crown, Eye, Heart, Users, BookOpen, UserPlus, UserCheck, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getPublicProfile, toggleFollow } from "@/lib/economy.functions";
import { getOrCreateConversation } from "@/lib/chat.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { StoryCard } from "@/components/StoryCard";

export const Route = createFileRoute("/u/$username")({ component: PublicProfile });

function PublicProfile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getPublicProfile);
  const follow = useServerFn(toggleFollow);
  const startChat = useServerFn(getOrCreateConversation);
  const [isFollowing, setIsFollowing] = useState(false);

  const q = useQuery({ queryKey: ["public-profile", username], queryFn: () => fetchProfile({ data: { username } }) });

  useEffect(() => {
    if (!user || !q.data?.profile) { setIsFollowing(false); return; }
    supabase.from("followers").select("id").eq("follower_id", user.id).eq("following_id", q.data.profile.id).maybeSingle()
      .then(({ data }) => setIsFollowing(!!data));
  }, [user, q.data?.profile]);

  const m = useMutation({
    mutationFn: (id: string) => follow({ data: { following_id: id } }),
    onSuccess: (r) => {
      setIsFollowing(r.following);
      toast.success(r.following ? "Following!" : "Unfollowed.");
      qc.invalidateQueries({ queryKey: ["public-profile", username] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="mx-auto max-w-4xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!q.data?.profile) return <div className="text-center py-20 text-muted-foreground">Profile tidak ditemukan. <Link to="/explore" className="text-primary">Explore</Link></div>;

  const p = q.data.profile;
  const isVip = p.vip_until && new Date(p.vip_until) > new Date();
  const isSelf = user?.id === p.id;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 sm:p-8 shadow-warm">
        <div className="flex items-center gap-5 flex-wrap">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt={p.username} className="h-24 w-24 rounded-full object-cover shadow-glow" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center text-3xl font-bold shadow-glow">
              {(p.display_name ?? p.username)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl font-semibold truncate">{p.display_name ?? p.username}</h1>
              {isVip && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-vip text-white text-[10px] font-bold uppercase"><Crown className="h-3 w-3" />VIP</span>}
              {q.data.stories.length > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase">Author</span>}
            </div>
            <p className="text-sm text-muted-foreground">@{p.username}</p>
            {p.bio && <p className="text-sm text-muted-foreground mt-2">{p.bio}</p>}
          </div>
          {!isSelf && user && (
            <div className="flex items-center gap-2">
              <button onClick={() => m.mutate(p.id)} disabled={m.isPending} className={`px-5 py-2 rounded-full font-medium text-sm inline-flex items-center gap-2 ${isFollowing ? "glass" : "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"}`}>
                {isFollowing ? <><UserCheck className="h-4 w-4" />Following</> : <><UserPlus className="h-4 w-4" />Follow</>}
              </button>
              <button
                onClick={async () => {
                  try {
                    const r = await startChat({ data: { other_user_id: p.id } });
                    navigate({ to: "/chat/$conversationId", params: { conversationId: r.conversation_id } });
                  } catch (e) { toast.error((e as Error).message); }
                }}
                className="px-5 py-2 rounded-full font-medium text-sm inline-flex items-center gap-2 glass hover:bg-accent/50"
              >
                <MessageCircle className="h-4 w-4" />Chat
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3 text-center">
          <div className="glass rounded-xl p-3"><BookOpen className="mx-auto h-4 w-4 text-primary" /><p className="font-display text-xl font-bold mt-1">{q.data.stories.length}</p><p className="text-xs text-muted-foreground">Stories</p></div>
          <div className="glass rounded-xl p-3"><Eye className="mx-auto h-4 w-4 text-primary" /><p className="font-display text-xl font-bold mt-1">{q.data.stats.total_views}</p><p className="text-xs text-muted-foreground">Views</p></div>
          <div className="glass rounded-xl p-3"><Heart className="mx-auto h-4 w-4 text-primary" /><p className="font-display text-xl font-bold mt-1">{q.data.stats.total_likes}</p><p className="text-xs text-muted-foreground">Likes</p></div>
          <div className="glass rounded-xl p-3"><Users className="mx-auto h-4 w-4 text-primary" /><p className="font-display text-xl font-bold mt-1">{q.data.stats.followers}</p><p className="text-xs text-muted-foreground">Followers</p></div>
        </div>
      </motion.div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold mb-4">Karya</h2>
        {q.data.stories.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-muted-foreground">Belum ada cerita yang dipublikasikan.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {q.data.stories.map((s, i) => (
              <StoryCard
                key={s.id}
                index={i}
                story={{
                  id: s.id, title: s.title, slug: s.slug, genre: s.genre,
                  views: s.views ?? 0, likes_count: s.likes_count ?? 0,
                  cover_gradient: s.cover_gradient ?? null,
                  cover_url: (s as { cover_url?: string | null }).cover_url ?? null,
                  author_id: p.id, author_name: p.display_name ?? p.username, author_avatar: p.avatar_url ?? null,
                  synopsis: null, tags: null, status: "published",
                  is_premium: !!(s as any).is_premium, is_vip: !!(s as any).is_vip, is_trending: !!(s as any).is_trending, is_recommended: false,
                  comments_count: 0, unlock_count: 0, favorite_count: 0,
                  created_at: "",
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}