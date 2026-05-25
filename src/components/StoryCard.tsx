import { Link } from "@tanstack/react-router";
import { Heart, Eye, Crown, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber, type Story } from "@/lib/types";

type StoryWithCover = Story & { cover_url?: string | null };

export function StoryCard({ story, index = 0 }: { story: StoryWithCover; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
    >
      <Link
        to="/story/$slug"
        params={{ slug: story.slug }}
        className="group block relative rounded-2xl overflow-hidden hover-lift focus:outline-none focus:ring-2 focus:ring-primary/60"
      >
        <div
          className="relative aspect-[3/4] w-full overflow-hidden"
          style={{ background: story.cover_gradient ?? "var(--gradient-warm)" }}
        >
          {story.cover_url && (
            <img
              src={story.cover_url}
              alt={story.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {/* Cover content overlay */}
          <div className="absolute inset-0 p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              {story.is_vip && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-vip/90 text-white text-[10px] font-bold uppercase tracking-wider">
                  <Crown className="h-3 w-3" /> VIP
                </span>
              )}
              {!story.is_vip && story.is_premium && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/90 text-foreground text-[10px] font-bold uppercase tracking-wider">
                  Premium
                </span>
              )}
              {story.is_trending && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur text-white text-[10px] font-semibold">
                  <Flame className="h-3 w-3" /> Trending
                </span>
              )}
            </div>
            <div className="text-white drop-shadow-lg">
              <p className="text-[10px] uppercase tracking-widest opacity-80">{story.genre}</p>
              <h3 className="mt-1 font-display text-lg leading-tight font-semibold line-clamp-3">
                {story.title}
              </h3>
            </div>
          </div>
          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
          </div>
        </div>

        <div className="p-3">
          <p className="text-xs text-muted-foreground truncate">by {story.author_name}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {formatNumber(story.views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" /> {formatNumber(story.likes_count)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function StoryCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="skeleton aspect-[3/4] w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}
