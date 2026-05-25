import { supabase } from "@/integrations/supabase/client";
import type { Story, Chapter } from "@/lib/types";

export async function fetchStories(opts: {
  genre?: string;
  search?: string;
  sort?: "trending" | "newest" | "popular" | "premium";
  limit?: number;
} = {}): Promise<Story[]> {
  let q = supabase.from("stories").select("*").eq("status", "published");
  if (opts.genre && opts.genre !== "all") q = q.eq("genre", opts.genre);
  if (opts.search) q = q.ilike("title", `%${opts.search}%`);
  if (opts.sort === "newest") q = q.order("created_at", { ascending: false });
  else if (opts.sort === "popular") q = q.order("likes_count", { ascending: false });
  else if (opts.sort === "premium") q = q.or("is_vip.eq.true,is_premium.eq.true").order("views", { ascending: false });
  else q = q.order("views", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Story[];
}

export async function fetchStoryBySlug(slug: string): Promise<Story | null> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Story | null;
}

export async function fetchChapters(storyId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("story_id", storyId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Chapter[];
}
