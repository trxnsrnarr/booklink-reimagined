import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const unlockChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("unlock_chapter", { _chapter_id: data.chapter_id });
    if (error) throw new Error(error.message);
    return result as { status: string; paid?: number; needed?: number; balance?: number };
  });

export const recordView = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client.server").then(m => ({ supabase: m.supabaseAdmin }));
    await supabase.rpc("record_chapter_view", { _chapter_id: data.chapter_id });
    return { ok: true };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ story_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("toggle_story_like", { _story_id: data.story_id });
    if (error) throw new Error(error.message);
    return r as { liked: boolean };
  });

export const checkUnlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("chapter_unlocks").select("id").eq("chapter_id", data.chapter_id).eq("user_id", context.userId).maybeSingle();
    return { unlocked: !!row };
  });

export const getAuthorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [earnings, stories, unlocks, withdrawals] = await Promise.all([
      supabase.from("author_earnings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("stories").select("id,title,slug,views,likes_count,unlock_count,favorite_count,cover_gradient,cover_url,genre,status,is_vip,is_premium").eq("author_id", userId).order("updated_at",{ascending:false}),
      supabase.from("chapter_unlocks").select("id,coin_paid,author_share,created_at,chapter_id").eq("author_id", userId).order("created_at",{ascending:false}).limit(50),
      supabase.from("withdrawals").select("*").eq("user_id", userId).order("created_at",{ascending:false}),
    ]);
    return {
      earnings: earnings.data ?? { total_earned: 0, balance: 0, withdrawn: 0 },
      stories: stories.data ?? [],
      recent_unlocks: unlocks.data ?? [],
      withdrawals: withdrawals.data ?? [],
    };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    amount_coin: z.number().int().min(500).max(1000000),
    method: z.enum(["dana","ovo","gopay","bank"]),
    account_info: z.object({
      account_name: z.string().min(1).max(100),
      account_number: z.string().min(3).max(50),
      bank_name: z.string().max(50).optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("request_withdrawal", {
      _amount_coin: data.amount_coin, _method: data.method, _account_info: data.account_info,
    });
    if (error) throw new Error(error.message);
    return r as { status: string };
  });

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin gate via has_role inside RLS
    const { data, error } = await context.supabase.from("withdrawals").select("*").order("created_at",{ascending:true});
    if (error) throw new Error(error.message);
    return { withdrawals: data ?? [] };
  });

export const processWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    status: z.enum(["approved","rejected","paid"]),
    note: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("process_withdrawal", {
      _id: data.id, _status: data.status, _note: data.note ?? "",
    });
    if (error) throw new Error(error.message);
    return r as { status: string };
  });

export const purchaseTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ theme_id: z.string().min(1).max(50), price: z.number().int().min(1).max(10000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("purchase_theme", { _theme_id: data.theme_id, _price: data.price });
    if (error) throw new Error(error.message);
    return r as { status: string };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: r, error } = await context.supabase.rpc("claim_ad_reward");
    if (error) throw new Error(error.message);
    return r as { status: string; coin?: number; remaining?: number };
  });

export const listMyThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("theme_purchases").select("theme_id").eq("user_id", context.userId);
    return { theme_ids: (data ?? []).map((r) => r.theme_id) };
  });

export const getPublicProfile = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ username: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id,username,display_name,avatar_url,bio,vip_until,created_at").eq("username", data.username).maybeSingle();
    if (!profile) return { profile: null, stories: [], stats: { followers: 0, total_views: 0, total_likes: 0 } };
    const [{ data: stories }, { count: followers }] = await Promise.all([
      supabaseAdmin.from("stories").select("id,title,slug,cover_url,cover_gradient,views,likes_count,genre,is_vip,is_premium,is_trending").eq("author_id", profile.id).eq("status","published").order("created_at",{ascending:false}),
      supabaseAdmin.from("followers").select("*",{count:"exact",head:true}).eq("following_id", profile.id),
    ]);
    const total_views = (stories ?? []).reduce((a,s)=>a+(s.views||0),0);
    const total_likes = (stories ?? []).reduce((a,s)=>a+(s.likes_count||0),0);
    return { profile, stories: stories ?? [], stats: { followers: followers ?? 0, total_views, total_likes } };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ following_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.following_id === userId) throw new Error("cant_follow_self");
    const { data: existing } = await supabase.from("followers").select("id").eq("follower_id", userId).eq("following_id", data.following_id).maybeSingle();
    if (existing) {
      await supabase.from("followers").delete().eq("id", existing.id);
      return { following: false };
    }
    await supabase.from("followers").insert({ follower_id: userId, following_id: data.following_id });
    return { following: true };
  });

export const searchUsers = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ q: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,username,display_name,avatar_url,bio,vip_until")
      .or(`username.ilike.%${data.q}%,display_name.ilike.%${data.q}%`)
      .limit(24);
    const ids = (profiles ?? []).map((p) => p.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: rows } = await supabaseAdmin
        .from("stories").select("author_id").in("author_id", ids).eq("status", "published");
      counts = (rows ?? []).reduce<Record<string, number>>((a, r) => {
        const k = r.author_id as string; a[k] = (a[k] ?? 0) + 1; return a;
      }, {});
    }
    return {
      users: (profiles ?? []).map((p) => ({ ...p, story_count: counts[p.id] ?? 0 })),
    };
  });

export const getMyAuthorStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: stories }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from("stories").select("id,title,slug,cover_url,cover_gradient,views,likes_count,unlock_count,genre,status,is_vip,is_premium,is_trending,created_at").eq("author_id", userId).order("created_at", { ascending: false }),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    const list = stories ?? [];
    const totals = list.reduce(
      (a, s) => ({
        views: a.views + (s.views ?? 0),
        likes: a.likes + (s.likes_count ?? 0),
        unlocks: a.unlocks + (s.unlock_count ?? 0),
      }),
      { views: 0, likes: 0, unlocks: 0 }
    );
    return { stories: list, stats: { ...totals, followers: followers ?? 0, following: following ?? 0 } };
  });

// Library management
export const listMyLibraries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: libs } = await context.supabase.from("libraries").select("id,name,is_default").eq("user_id", context.userId).order("is_default", { ascending: false });
    const ids = (libs ?? []).map((l) => l.id);
    let counts: Record<string, number> = {};
    let storyMembership: Record<string, string[]> = {};
    if (ids.length) {
      const { data: items } = await context.supabase.from("library_items").select("library_id, story_id").in("library_id", ids);
      for (const it of items ?? []) {
        counts[it.library_id] = (counts[it.library_id] ?? 0) + 1;
        (storyMembership[it.story_id] ??= []).push(it.library_id);
      }
    }
    return { libraries: (libs ?? []).map((l) => ({ ...l, count: counts[l.id] ?? 0 })), membership: storyMembership };
  });

export const createLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ name: z.string().trim().min(1).max(60) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("libraries").insert({ user_id: context.userId, name: data.name }).select("id,name,is_default").single();
    if (error) throw new Error(error.message);
    return { library: row };
  });

export const renameLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("libraries").update({ name: data.name }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("library_items").delete().eq("library_id", data.id);
    const { error } = await context.supabase.from("libraries").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ library_id: z.string().uuid(), story_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // verify ownership
    const { data: lib } = await context.supabase.from("libraries").select("id").eq("id", data.library_id).eq("user_id", context.userId).maybeSingle();
    if (!lib) throw new Error("not_found");
    const { data: existing } = await context.supabase.from("library_items").select("id").eq("library_id", data.library_id).eq("story_id", data.story_id).maybeSingle();
    if (existing) {
      await context.supabase.from("library_items").delete().eq("id", existing.id);
      return { added: false };
    }
    await context.supabase.from("library_items").insert({ library_id: data.library_id, story_id: data.story_id });
    return { added: true };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ story_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase.from("favorites").select("id").eq("user_id", context.userId).eq("story_id", data.story_id).maybeSingle();
    if (existing) {
      await context.supabase.from("favorites").delete().eq("id", existing.id);
      // favorite_count is informational; no decrement RPC needed
      return { favorited: false };
    }
    await context.supabase.from("favorites").insert({ user_id: context.userId, story_id: data.story_id });
    return { favorited: true };
  });

export const isFavorited = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ story_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("favorites").select("id").eq("user_id", context.userId).eq("story_id", data.story_id).maybeSingle();
    return { favorited: !!row };
  });

export const isFollowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ following_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("followers").select("id").eq("follower_id", context.userId).eq("following_id", data.following_id).maybeSingle();
    return { following: !!row };
  });
