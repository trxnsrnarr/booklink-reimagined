import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Heart, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toggleFavorite } from "@/lib/economy.functions";
import type { Story } from "@/lib/types";
import { formatNumber } from "@/lib/types";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorit Saya — BookLink" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const favToggle = useServerFn(toggleFavorite);

  const q = useQuery({
    enabled: !!user,
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("created_at, story_id, stories(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as { created_at: string; story_id: string; stories: Story }[];
    },
  });

  const removeM = useMutation({
    mutationFn: (story_id: string) => favToggle({ data: { story_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["fav"] });
      toast.success("Dihapus dari favorit.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="mx-auto max-w-7xl px-6 py-10"><div className="skeleton h-10 w-48" /></div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="glass-strong rounded-3xl p-10">
          <Heart className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Favorit Saya</h1>
          <p className="mt-2 text-sm text-muted-foreground">Login untuk melihat cerita favoritmu.</p>
          <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow">Login</Link>
        </div>
      </div>
    );
  }

  const items = q.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold inline-flex items-center gap-3">
          <Heart className="h-9 w-9 text-primary fill-current" /> Favorit Saya
        </h1>
        <p className="mt-2 text-muted-foreground">{items.length} cerita favorit.</p>
      </motion.div>

      {q.isLoading ? (
        <div className="mt-8 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="mt-10 glass-strong rounded-3xl p-10 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Belum ada cerita favorit. Mulai jelajah dan tekan tombol favorite di halaman cerita.</p>
          <Link to="/explore" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow">Jelajah Cerita</Link>
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => {
            const s = it.stories;
            if (!s) return null;
            return (
              <motion.div
                key={it.story_id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="glass rounded-2xl overflow-hidden flex"
              >
                <Link to="/story/$slug" params={{ slug: s.slug }} className="relative w-28 shrink-0 aspect-[3/4]" style={{ background: s.cover_gradient ?? "var(--gradient-warm)" }}>
                  {s.cover_url && <img src={s.cover_url} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />}
                </Link>
                <div className="flex-1 p-3 flex flex-col">
                  <p className="text-[10px] uppercase tracking-widest text-primary">{s.genre}</p>
                  <Link to="/story/$slug" params={{ slug: s.slug }} className="mt-0.5 font-display font-semibold leading-tight line-clamp-2 hover:text-primary">
                    {s.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">{s.author_name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatNumber(s.favorite_count)} favorit · {formatNumber(s.views)} views</p>
                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <Link to="/story/$slug" params={{ slug: s.slug }} className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/25">
                      <BookOpen className="h-3.5 w-3.5" /> Baca
                    </Link>
                    <button
                      onClick={() => removeM.mutate(it.story_id)}
                      disabled={removeM.isPending}
                      className="inline-flex items-center gap-1 rounded-full glass px-3 py-1 text-xs hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
