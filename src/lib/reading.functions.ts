import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordReadingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("record_reading_progress", { _chapter_id: data.chapter_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStoryProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ story_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("reading_progress")
      .select("chapter_id, updated_at")
      .eq("user_id", context.userId)
      .eq("story_id", data.story_id)
      .maybeSingle();
    return row as { chapter_id: string; updated_at: string } | null;
  });

export const getRecentReads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rp, error } = await context.supabase
      .from("reading_progress")
      .select("story_id, chapter_id, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(12);
    if (error) throw new Error(error.message);
    const rows = rp ?? [];
    if (!rows.length) return [];
    const storyIds = rows.map((r) => r.story_id);
    const { data: stories } = await context.supabase
      .from("stories")
      .select("*")
      .in("id", storyIds);
    const map = new Map((stories ?? []).map((s: any) => [s.id, s]));
    return rows
      .map((r) => {
        const s = map.get(r.story_id);
        if (!s) return null;
        return { ...s, _last_chapter_id: r.chapter_id, _read_at: r.updated_at };
      })
      .filter(Boolean);
  });
