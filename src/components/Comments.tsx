import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Trash2, Send, Crown, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Target = { storyId?: string; chapterId?: string };

interface CommentRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  chapter_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  is_deleted: boolean;
  author?: { username: string; display_name: string | null; avatar_url: string | null; vip_until: string | null } | null;
  chapter?: { id: string; title: string; order_index: number } | null;
  liked_by_me?: boolean;
}

async function fetchComments(target: Target, userId?: string): Promise<CommentRow[]> {
  let rows: CommentRow[] = [];

  if (target.chapterId) {
    const { data, error } = await supabase
      .from("comments")
      .select("id,user_id,parent_id,chapter_id,content,likes_count,created_at,is_deleted")
      .eq("chapter_id", target.chapterId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    rows = (data ?? []) as CommentRow[];
  } else if (target.storyId) {
    // Aggregate: comments tied directly to the story OR to any of its chapters
    const { data: chs } = await supabase.from("chapters").select("id,title,order_index").eq("story_id", target.storyId);
    const chapterIds = (chs ?? []).map((c: any) => c.id);
    const orParts = [`story_id.eq.${target.storyId}`];
    if (chapterIds.length) orParts.push(`chapter_id.in.(${chapterIds.join(",")})`);
    const { data, error } = await supabase
      .from("comments")
      .select("id,user_id,parent_id,chapter_id,content,likes_count,created_at,is_deleted")
      .or(orParts.join(","))
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    rows = (data ?? []) as CommentRow[];
    const chMap = new Map((chs ?? []).map((c: any) => [c.id, c]));
    rows = rows.map((r) => ({ ...r, chapter: r.chapter_id ? (chMap.get(r.chapter_id) as any) ?? null : null }));
  }

  if (!rows.length) return [];
  const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: authors } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,vip_until")
    .in("id", authorIds);
  const authorMap = new Map(((authors ?? []) as any[]).map((a) => [a.id, a]));
  let likedSet = new Set<string>();
  if (userId) {
    const { data: likes } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", userId)
      .in("comment_id", rows.map((r) => r.id));
    likedSet = new Set(((likes ?? []) as any[]).map((l) => l.comment_id));
  }
  return rows.map((r) => ({ ...r, author: authorMap.get(r.user_id) ?? null, liked_by_me: likedSet.has(r.id) }));
}

export function Comments({ storyId, chapterId }: Target) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const target = useMemo(() => ({ storyId, chapterId }), [storyId, chapterId]);
  const key = ["comments", chapterId ?? storyId, user?.id ?? null];
  const isAggregate = !chapterId && !!storyId;

  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchComments(target, user?.id),
    enabled: !!(storyId || chapterId),
  });

  // Realtime — for chapter mode, filter; for story mode, listen to all comments
  useEffect(() => {
    if (!storyId && !chapterId) return;
    const ch = supabase
      .channel(`comments-${chapterId ?? storyId}`)
      .on(
        "postgres_changes",
        chapterId
          ? { event: "*", schema: "public", table: "comments", filter: `chapter_id=eq.${chapterId}` }
          : { event: "*", schema: "public", table: "comments" },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, chapterId]);

  // Scroll to comment from URL hash (#comment-xxx) when data loads
  useEffect(() => {
    if (typeof window === "undefined" || !q.data) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    }
  }, [q.data]);


  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  const submit = async () => {
    if (!user) { toast.error("Login dulu untuk berkomentar"); return; }
    const content = text.trim();
    if (!content) return;
    if (content.length > 2000) { toast.error("Maksimal 2000 karakter"); return; }
    setSubmitting(true);
    const payload: any = { user_id: user.id, content, parent_id: replyTo };
    if (chapterId) payload.chapter_id = chapterId;
    else if (storyId) payload.story_id = storyId;
    const { error } = await supabase.from("comments").insert(payload);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    setReplyTo(null);
    qc.invalidateQueries({ queryKey: key });
  };

  const toggleLike = async (id: string) => {
    if (!user) { toast.error("Login dulu"); return; }
    const { error } = await supabase.rpc("toggle_comment_like", { _comment_id: id });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: key });
  };

  const all = q.data ?? [];
  // In aggregate mode show flat list (newest first); in chapter mode show threaded
  const allRoots = isAggregate ? all : all.filter((c) => !c.parent_id);
  const roots = isAggregate ? allRoots.slice(0, visibleCount) : allRoots;
  const repliesOf = (id: string) => all.filter((c) => c.parent_id === id);

  return (
    <section className="mt-10 not-prose text-foreground">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-semibold">Komentar ({all.length})</h2>
      </div>

      {isAggregate ? (
        <p className="text-xs text-muted-foreground mb-4">
          Komentar dari semua chapter cerita ini. Buka chapter untuk ikut berkomentar.
        </p>
      ) : (
        <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 mb-6 shadow-sm">
          {replyTo && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
              <span>Membalas komentar…</span>
              <button onClick={() => setReplyTo(null)} className="text-primary hover:underline">Batal</button>
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={user ? "Tulis komentar yang ramah…" : "Login untuk berkomentar"}
            rows={3}
            disabled={!user || submitting}
            className="w-full bg-background text-foreground border border-border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none disabled:opacity-60"
            maxLength={2000}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{text.length}/2000</span>
            <button
              onClick={submit}
              disabled={!user || submitting || !text.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Kirim
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6 text-center">Belum ada komentar. Jadilah yang pertama!</p>
      ) : (
        <ul className="space-y-4">
          {roots.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              replies={isAggregate ? [] : repliesOf(c.id)}
              currentUserId={user?.id}
              onReply={isAggregate ? undefined : (id) => setReplyTo(id)}
              onLike={toggleLike}
              onDelete={deleteComment}
              showChapter={isAggregate}
            />
          ))}
        </ul>
      )}
      {isAggregate && allRoots.length > visibleCount && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setVisibleCount((v) => v + 10)}
            className="px-5 py-2 rounded-full glass-strong hover:bg-accent/50 text-sm font-medium transition"
          >
            Lihat Lebih Banyak Komentar ({allRoots.length - visibleCount})
          </button>
        </div>
      )}
    </section>
  );
}

function CommentItem({
  c, replies, currentUserId, onReply, onLike, onDelete, showChapter,
}: {
  c: CommentRow; replies: CommentRow[]; currentUserId?: string;
  onReply?: (id: string) => void; onLike: (id: string) => void; onDelete: (id: string) => void;
  showChapter?: boolean;
}) {
  const isVip = !!c.author?.vip_until && new Date(c.author.vip_until) > new Date();
  const name = c.author?.display_name || c.author?.username || "User";
  return (
    <li id={`comment-${c.id}`} className="bg-card text-card-foreground border border-border rounded-2xl p-4 shadow-sm scroll-mt-24">

      <div className="flex gap-3">
        <Link to="/u/$username" params={{ username: c.author?.username ?? "" }} className="shrink-0">
          {c.author?.avatar_url ? (
            <img src={c.author.avatar_url} alt={name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/u/$username" params={{ username: c.author?.username ?? "" }} className="font-medium text-sm hover:underline truncate">
              {name}
            </Link>
            {isVip && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-vip/15 text-vip"><Crown className="h-3 w-3" />VIP</span>}
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            {showChapter && c.chapter && (
              <Link
                to="/read/$chapterId"
                params={{ chapterId: c.chapter.id }}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              >
                <BookOpen className="h-3 w-3" /> Ch {c.chapter.order_index}: {c.chapter.title.slice(0, 30)}
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.content}</p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <button onClick={() => onLike(c.id)} className={`inline-flex items-center gap-1 hover:text-primary transition ${c.liked_by_me ? "text-primary" : "text-muted-foreground"}`}>
              <Heart className={`h-3.5 w-3.5 ${c.liked_by_me ? "fill-current" : ""}`} /> {c.likes_count}
            </button>
            {onReply && (
              <button onClick={() => onReply(c.id)} className="text-muted-foreground hover:text-primary transition">Balas</button>
            )}
            {currentUserId === c.user_id && (
              <button onClick={() => onDelete(c.id)} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-destructive transition">
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            )}
          </div>

          {replies.length > 0 && (
            <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
              {replies.map((r) => {
                const rName = r.author?.display_name || r.author?.username || "User";
                const rVip = !!r.author?.vip_until && new Date(r.author.vip_until) > new Date();
                return (
                  <li key={r.id} id={`comment-${r.id}`} className="flex gap-2 scroll-mt-24">
                    <Link to="/u/$username" params={{ username: r.author?.username ?? "" }} className="shrink-0">
                      {r.author?.avatar_url ? (
                        <img src={r.author.avatar_url} alt={rName} className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground text-xs font-semibold">
                          {rName[0]?.toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-xs">{rName}</span>
                        {rVip && <Crown className="h-3 w-3 text-vip" />}
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <button onClick={() => onLike(r.id)} className={`inline-flex items-center gap-1 hover:text-primary ${r.liked_by_me ? "text-primary" : "text-muted-foreground"}`}>
                          <Heart className={`h-3 w-3 ${r.liked_by_me ? "fill-current" : ""}`} /> {r.likes_count}
                        </button>
                        {currentUserId === r.user_id && (
                          <button onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
