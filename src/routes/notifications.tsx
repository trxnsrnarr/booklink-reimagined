import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

interface Notif { id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string; }

function NotificationsPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (active) setItems((data as Notif[]) ?? []); });
    const ch = supabase.channel(`notifpage-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => {
          if (p.eventType === "INSERT") setItems((prev) => [p.new as Notif, ...prev]);
          else if (p.eventType === "UPDATE") setItems((prev) => prev.map((n) => n.id === (p.new as Notif).id ? p.new as Notif : n));
          else if (p.eventType === "DELETE") setItems((prev) => prev.filter((n) => n.id !== (p.old as Notif).id));
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <Bell className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("nav.notifications")}</h1>
        <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">{t("nav.login")}</Link>
      </div>
    );
  }

  const markAll = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold">{t("nav.notifications")}</h1>
          <p className="mt-2 text-muted-foreground text-sm">Realtime — update otomatis muncul.</p>
        </div>
        {items.some((i) => !i.is_read) && (
          <button onClick={markAll} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm hover:bg-accent/50">
            <CheckCheck className="h-4 w-4" /> {t("notif.markAll")}
          </button>
        )}
      </motion.div>

      <div className="mt-8 space-y-2">
        {items.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">{t("notif.empty")}</div>
        ) : (
          items.map((n) => (
            <div key={n.id} className={`glass rounded-2xl p-5 ${!n.is_read ? "border-l-4 border-primary" : ""}`}>
              <p className="font-semibold">{n.title}</p>
              {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
              <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
