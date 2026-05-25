import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ other_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("get_or_create_conversation", { _other: data.other_user_id });
    if (error) throw new Error(error.message);
    return { conversation_id: id as unknown as string };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_conversation_read", { _conv: data.conversation_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
