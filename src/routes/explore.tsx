import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Crown, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { StoryCard, StoryCardSkeleton } from "@/components/StoryCard";
import { fetchStories } from "@/lib/queries";
import { GENRES } from "@/lib/types";
import { searchUsers } from "@/lib/economy.functions";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore Stories — BookLink" }] }),
  component: ExplorePage,
});

function ExplorePage() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState<"trending" | "newest" | "popular" | "premium">("trending");
  const [tab, setTab] = useState<"stories" | "users">("stories");
  const findUsers = useServerFn(searchUsers);

  const { data, isLoading, isError, refetch } = useQuery({
    enabled: tab === "stories",
    queryKey: ["explore", genre, sort, search],
    queryFn: () => fetchStories({ genre, sort, search: search || undefined }),
  });

  const usersQ = useQuery({
    enabled: tab === "users" && search.trim().length > 0,
    queryKey: ["explore-users", search],
    queryFn: () => findUsers({ data: { q: search.trim() } }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold">Explore</h1>
        <p className="mt-2 text-muted-foreground">Temukan cerita & penulis berikutnya yang akan kamu jatuh cintai.</p>
      </motion.div>

      <div className="mt-8 space-y-4">
        <div className="flex gap-2">
          {(["stories","users"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === t ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow" : "glass hover:bg-accent/50"}`}>
              {t === "stories" ? "Cerita" : "Penulis"}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "stories" ? "Cari judul cerita..." : "Cari nama atau @username..."}
            className="w-full pl-11 pr-4 py-3 rounded-full glass-strong text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>

        {tab === "stories" && (<>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g.value}
              onClick={() => setGenre(g.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                genre === g.value
                  ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
                  : "glass hover:bg-accent/50"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { v: "trending", l: "Trending" },
            { v: "popular", l: "Popular" },
            { v: "newest", l: "Newest" },
            { v: "premium", l: "Premium" },
          ] as const).map((s) => (
            <button
              key={s.v}
              onClick={() => setSort(s.v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                sort === s.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>
        </>)}
      </div>

      <div className="mt-8">
        {tab === "users" ? (
          !search.trim() ? (
            <div className="text-center py-20 glass rounded-2xl text-muted-foreground">Ketik nama atau username untuk mencari penulis.</div>
          ) : usersQ.isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i=><div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>
          ) : !usersQ.data?.users.length ? (
            <div className="text-center py-20 glass rounded-2xl text-muted-foreground">Tidak ada user ditemukan.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {usersQ.data.users.map((u) => {
                const isVip = u.vip_until && new Date(u.vip_until) > new Date();
                return (
                  <Link key={u.id} to="/u/$username" params={{ username: u.username }} className="glass rounded-2xl p-4 flex items-center gap-3 hover-lift">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground grid place-items-center font-bold">{(u.display_name ?? u.username)[0]?.toUpperCase()}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{u.display_name ?? u.username}</p>
                        {isVip && <Crown className="h-3.5 w-3.5 text-vip" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                      <p className="text-[11px] text-primary mt-0.5 inline-flex items-center gap-1"><BookOpen className="h-3 w-3" />{u.story_count} cerita{u.story_count > 0 ? " · Author" : ""}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Gagal memuat cerita.</p>
            <button onClick={() => refetch()} className="mt-4 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm">
              Coba lagi
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <StoryCardSkeleton key={i} />)}
          </div>
        ) : !data?.length ? (
          <div className="text-center py-20 glass rounded-2xl">
            <p className="text-muted-foreground">Tidak ada cerita yang cocok dengan filter ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.map((s, i) => <StoryCard key={s.id} story={s} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
