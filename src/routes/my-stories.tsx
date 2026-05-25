import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookMarked, PenLine } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-stories")({ component: MyStoriesPage });

function MyStoriesPage() {
  const { user, loading } = useAuth();
  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["my-stories-list", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("stories").select("*").eq("author_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <BookMarked className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">My Stories</h1>
        <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">Login</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-4xl font-semibold">My Stories</h1>
        <Link to="/write" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium shadow-glow">
          <PenLine className="h-4 w-4" /> Tulis
        </Link>
      </motion.div>
      <div className="mt-8 space-y-3">
        {!data?.length ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Belum ada cerita. Klik "Tulis" untuk mulai.</div>
        ) : (
          data.map((s) => (
            <Link key={s.id} to="/write/$storyId" params={{ storyId: s.id }} className="block glass-strong rounded-2xl p-5 hover:bg-accent/30 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold truncate">{s.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{s.genre} · {s.status} · {s.views} views</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
