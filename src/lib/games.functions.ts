import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClaimResult = {
  status: "success" | "limit_reached" | "level_required";
  reward_tenths?: number;
  used_tenths?: number;
  remaining_tenths?: number;
  cap_tenths?: number;
  coin_balance?: number;
  fraction_tenths?: number;
  required_level?: number;
  current_level?: number;
};

export type GameStats = {
  used_tenths: number;
  cap_tenths: number;
  remaining_tenths: number;
  fraction_tenths: number;
  coin_balance: number;
  total_plays: number;
  total_rewards_tenths: number;
  highest_level: number;
};

export type ProgressResult = {
  level: number;
  best_score: number;
  total_plays: number;
  reached_max: boolean;
};

const gameNameSchema = z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/);

export const claimGameReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ game_name: gameNameSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("claim_game_reward", { _game_name: data.game_name });
    if (error) throw new Error(error.message);
    return r as ClaimResult;
  });

export const recordGamePlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      game_name: gameNameSchema,
      score: z.number().int().min(0).max(10_000_000),
      level_completed: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("record_game_play", {
      _game_name: data.game_name,
      _score: data.score,
      _level_completed: data.level_completed,
    });
    if (error) throw new Error(error.message);
    return r as ProgressResult;
  });

export const getGameStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_game_stats");
    if (error) throw new Error(error.message);
    return data as GameStats;
  });

export const getGameProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("game_progress")
      .select("game_name, level, best_score, total_plays, last_played_at")
      .order("last_played_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      game_name: string;
      level: number;
      best_score: number;
      total_plays: number;
      last_played_at: string;
    }>;
  });
