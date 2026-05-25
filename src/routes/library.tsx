import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Library as LibraryIcon, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { StoryCard, StoryCardSkeleton } from "@/components/StoryCard";
import type { Story } from "@/lib/types";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["library", user?.id],
    queryFn: async () => {
      const { data: libs } = await supabase.from("libraries").select("*").eq("user_id", user!.id);
      const { data: items } = await supabase
        .from("library_items")
        .select("library_id, stories(*)")
        .in("library_id", (libs ?? []).map((l: { id: string }) => l.id));
      return {
        libraries: libs ?? [],
        items: (items ?? []) as { library_id: string; stories: Story }[],
      };
    },
  });

  if (authLoading) {
    return <div className="mx-auto max-w-7xl px-6 py-10"><div className="skeleton h-10 w-48" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="glass-strong rounded-3xl p-10">
          <LibraryIcon className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Library Pribadimu</h1>
          <p className="mt-2 text-sm text-muted-foreground">Login untuk mengakses koleksi cerita yang kamu simpan.</p>
          <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow">
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold">Library</h1>
        <p className="mt-2 text-muted-foreground">Koleksi pribadimu, terorganisir seperti rak buku.</p>
      </motion.div>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <StoryCardSkeleton key={i} />)}
        </div>
      ) : !data?.libraries.length ? (
        <p className="mt-10 text-muted-foreground">Belum ada library.</p>
      ) : (
        <div className="mt-10 space-y-12">
          {data.libraries.map((lib) => {
            const libItems = data.items.filter((it) => it.library_id === lib.id);
            return (
              <section key={lib.id}>
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl font-semibold">{lib.name}</h2>
                  <span className="text-xs text-muted-foreground">{libItems.length} cerita</span>
                </div>
                {libItems.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                    Library ini kosong. Tambah cerita dari halaman detail story.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {libItems.map((it, i) => <StoryCard key={it.stories.id} story={it.stories} index={i} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
