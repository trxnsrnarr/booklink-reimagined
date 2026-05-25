import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/chat")({ component: ChatListPage });

type ConversationRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  other?: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  unread: number;
};

function ChatListPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!user,
    queryKey: ["conversations", user?.id],
    queryFn: async (): Promise<ConversationRow[]> => {
      const me = user!.id;
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("id,user1_id,user2_id,last_message,last_message_at,last_sender_id")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = (convs ?? []) as ConversationRow[];
      if (!rows.length) return [];
      const otherIds = Array.from(new Set(rows.map((r) => (r.user1_id === me ? r.user2_id : r.user1_id))));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", otherIds);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      // unread counts in parallel
      const unreadCounts = await Promise.all(
        rows.map(async (r) => {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", r.id)
            .neq("sender_id", me)
            .is("read_at", null);
          return count ?? 0;
        })
      );

      return rows.map((r, i) => ({
        ...r,
        other: pmap.get(r.user1_id === me ? r.user2_id : r.user1_id) as any,
        unread: unreadCounts[i],
      }));
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <MessageCircle className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Chat</h1>
        <p className="mt-2 text-sm text-muted-foreground">Login untuk membuka chat.</p>
        <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow">Login</Link>
      </div>
    );
  }

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl font-semibold">Chat</h1>
      </div>
      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="glass-strong rounded-3xl p-10 text-center">
          <p className="text-muted-foreground">Belum ada percakapan. Kunjungi profil seseorang dan tekan tombol Chat.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const name = c.other?.display_name || c.other?.username || "User";
            return (
              <li key={c.id}>
                <Link
                  to="/chat/$conversationId"
                  params={{ conversationId: c.id }}
                  className="flex items-center gap-3 glass rounded-2xl p-3 hover-lift"
                >
                  {c.other?.avatar_url ? (
                    <img src={c.other.avatar_url} alt={name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center text-base font-semibold">
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{name}</p>
                      {c.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${c.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {c.last_sender_id === user.id ? "Kamu: " : ""}{c.last_message ?? <span className="italic opacity-60">Belum ada pesan</span>}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
