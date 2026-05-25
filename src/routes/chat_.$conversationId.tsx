import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markConversationRead } from "@/lib/chat.functions";

export const Route = createFileRoute("/chat_/$conversationId")({ component: ChatThreadPage });

type Msg = { id: string; conversation_id: string; sender_id: string; content: string; read_at: string | null; created_at: string };

function ChatThreadPage() {
  const { conversationId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const markRead = useServerFn(markConversationRead);
  const endRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const convQ = useQuery({
    enabled: !!user,
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data: c, error } = await supabase
        .from("conversations")
        .select("id,user1_id,user2_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const otherId = c.user1_id === user!.id ? c.user2_id : c.user1_id;
      const { data: p } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      return { conv: c, other: p };
    },
  });

  const msgsQ = useQuery({
    enabled: !!user,
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,content,read_at,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  // Mark read on mount + whenever messages change
  useEffect(() => {
    if (!user || !msgsQ.data) return;
    markRead({ data: { conversation_id: conversationId } })
      .then(() => qc.invalidateQueries({ queryKey: ["notif-unread"] }))
      .catch(() => {});
  }, [user, conversationId, msgsQ.data, markRead, qc]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`thread-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversationId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, conversationId, qc]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgsQ.data]);

  const send = async () => {
    if (!user || sending) return;
    const content = text.trim();
    if (!content) return;
    if (content.length > 4000) { toast.error("Pesan terlalu panjang"); return; }
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["messages", conversationId] });
  };

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!user) { navigate({ to: "/login" }); return null; }

  const other = convQ.data?.other;
  const name = other?.display_name || other?.username || "User";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 flex flex-col" style={{ minHeight: "calc(100vh - 4rem)" }}>
      <div className="flex items-center gap-3 mb-4 sticky top-16 z-10 glass-strong rounded-2xl p-3">
        <Link to="/chat" className="p-2 rounded-full hover:bg-accent/50"><ArrowLeft className="h-4 w-4" /></Link>
        {other && (
          <Link to="/u/$username" params={{ username: other.username }} className="flex items-center gap-3 flex-1 min-w-0">
            {other.avatar_url ? (
              <img src={other.avatar_url} alt={name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center font-semibold">
                {name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">@{other.username}</p>
            </div>
          </Link>
        )}
      </div>

      <div className="flex-1 space-y-3 py-4">
        {msgsQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}</div>
        ) : (msgsQ.data ?? []).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Belum ada pesan. Sapa dia duluan! 👋</p>
        ) : (
          msgsQ.data!.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground" : "bg-card border border-border"}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    {mine && m.read_at && " · dibaca"}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 glass-strong rounded-2xl p-3 mt-2">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Tulis pesan…"
            rows={1}
            maxLength={4000}
            className="flex-1 bg-background text-foreground border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="px-4 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
