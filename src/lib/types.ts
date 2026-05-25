export type Genre = "romance" | "fantasy" | "horror" | "action" | "school" | "sci-fi";

export interface Story {
  id: string;
  author_id: string | null;
  author_name: string;
  author_avatar: string | null;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  cover_gradient: string | null;
  genre: string;
  tags: string[] | null;
  status: string;
  is_premium: boolean;
  is_vip: boolean;
  views: number;
  likes_count: number;
  comments_count: number;
  unlock_count: number;
  favorite_count: number;
  is_trending: boolean;
  is_recommended: boolean;
  created_at: string;
}

export interface Chapter {
  id: string;
  story_id: string;
  title: string;
  content: string;
  order_index: number;
  is_premium: boolean;
  coin_price: number;
  word_count: number;
  reader_count: number;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  coin_balance: number;
  is_verified: boolean;
  created_at: string;
  vip_until?: string | null;
  vip_unlock_limit?: number | null;
  vip_unlock_used?: number | null;
  vip_cycle_started_at?: string | null;
}


export const GENRES: { value: string; label: string }[] = [
  { value: "all", label: "All Genres" },
  { value: "romance", label: "Romance" },
  { value: "fantasy", label: "Fantasy" },
  { value: "horror", label: "Horror" },
  { value: "thriller", label: "Thriller" },
  { value: "mystery", label: "Mystery" },
  { value: "school", label: "School" },
  { value: "action", label: "Action" },
  { value: "adventure", label: "Adventure" },
  { value: "comedy", label: "Comedy" },
  { value: "slice-of-life", label: "Slice of Life" },
  { value: "historical", label: "Historical" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "supernatural", label: "Supernatural" },
  { value: "psychological", label: "Psychological" },
  { value: "drama", label: "Drama" },
  { value: "crime", label: "Crime" },
  { value: "family", label: "Family" },
  { value: "music", label: "Music" },
  { value: "kingdom", label: "Kingdom" },
  { value: "survival", label: "Survival" },
  { value: "dark-romance", label: "Dark Romance" },
  { value: "mafia", label: "Mafia" },
  { value: "ceo", label: "CEO" },
  { value: "fanfiction", label: "Fanfiction" },
  { value: "werewolf", label: "Werewolf" },
  { value: "vampire", label: "Vampire" },
  { value: "isekai", label: "Isekai" },
  { value: "reincarnation", label: "Reincarnation" },
  { value: "time-travel", label: "Time Travel" },
  { value: "apocalypse", label: "Apocalypse" },
  { value: "dystopian", label: "Dystopian" },
  { value: "teen-fiction", label: "Teen Fiction" },
  { value: "mature", label: "Mature" },
];

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
