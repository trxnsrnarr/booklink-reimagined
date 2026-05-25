import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { supabase } from "@/integrations/supabase/client";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let active = true;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (active) setItems((data as Notif[]) ?? []); });

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setItems((prev) => [payload.new as Notif, ...prev].slice(0, 10));
          else if (payload.eventType === "UPDATE") setItems((prev) => prev.map((n) => n.id === (payload.new as Notif).id ? (payload.new as Notif) : n));
          else if (payload.eventType === "DELETE") setItems((prev) => prev.filter((n) => n.id !== (payload.old as Notif).id));
        })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const unread = items.filter((i) => !i.is_read).length;

  if (!user) return null;

  const markAll = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-full glass hover:bg-accent/50 flex items-center justify-center transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)] animate-pulse" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] glass-strong rounded-2xl shadow-warm overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <p className="font-semibold text-sm">{t("nav.notifications")}</p>
                {unread > 0 && (
                  <button onClick={markAll} className="text-xs text-primary hover:underline">{t("notif.markAll")}</button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8 px-4">{t("notif.empty")}</p>
                ) : (
                  items.map((n) => (
                    <Link
                      key={n.id}
                      to={n.link || "/notifications"}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 text-sm border-b border-border/40 hover:bg-accent/40 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                    >
                      <p className="font-medium">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </Link>
                  ))
                )}
              </div>
              <div className="border-t border-border/60">
                <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center py-2.5 text-xs text-primary hover:bg-accent/40 transition-colors">
                  {t("nav.notifications")} →
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
