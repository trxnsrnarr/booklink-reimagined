import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Search, Library, Wallet, PenLine, Info, User as UserIcon, LogOut, Settings, Receipt, Menu, X, Crown, LayoutDashboard, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationsBell } from "./NotificationsBell";


export function Navbar() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_ITEMS = [
    { to: "/", label: t("nav.home"), icon: BookOpen },
    { to: "/explore", label: t("nav.explore"), icon: Search },
    { to: "/library", label: t("nav.library"), icon: Library },
    { to: "/wallet", label: t("nav.wallet"), icon: Wallet },
    { to: "/write", label: t("nav.write"), icon: PenLine },
    { to: "/about", label: t("nav.about"), icon: Info },
  ];

  const handleLogout = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  // Unread chat counter (realtime)
  const unreadChatQ = useQuery({
    enabled: !!user,
    queryKey: ["chat-unread", user?.id],
    queryFn: async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`);
      const ids = (convs ?? []).map((c: any) => c.id);
      if (!ids.length) return 0;
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", ids)
        .neq("sender_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`nav-chat-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-unread"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unreadChat = unreadChatQ.data ?? 0;

  const initial = (profile?.display_name || profile?.username || user?.email || "U")[0]?.toUpperCase();
  const isVip = !!profile?.vip_until && new Date(profile.vip_until) > new Date();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass-strong border-b border-border/60">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-2">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="relative">
              <BookOpen className="h-7 w-7 text-primary transition-transform group-hover:scale-110" />
              <div className="absolute inset-0 blur-lg bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-display text-xl font-bold text-gradient-warm">BookLink</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/40"
                activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground rounded-lg bg-accent/60" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <LanguageToggle />
              <ThemeToggle />
              {user && (
                <Link to="/chat" className="relative p-2 rounded-lg hover:bg-accent/50 transition-colors" aria-label="Chat">
                  <MessageCircle className="h-5 w-5" />
                  {unreadChat > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                      {unreadChat > 99 ? "99+" : unreadChat}
                    </span>
                  )}
                </Link>
              )}
              <NotificationsBell />
            </div>
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-accent/50 transition-all"
                  aria-label="Account menu"
                >
                  <div className={`h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center text-sm font-semibold shadow-glow ${isVip ? "ring-2 ring-vip" : ""}`}>
                    {initial}
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium max-w-[140px] truncate">
                    {isVip && <Crown className="h-3.5 w-3.5 text-vip shrink-0" />}
                    <span className="truncate">{profile?.username ?? "..."}</span>
                  </span>
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-64 glass-strong rounded-2xl shadow-warm overflow-hidden z-50"
                      >
                        <div className="p-4 border-b border-border/60">
                          <p className="font-semibold truncate inline-flex items-center gap-1.5">
                            {isVip && <Crown className="h-4 w-4 text-vip" />}
                            {profile?.display_name ?? profile?.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-gold/30 to-primary/20 text-foreground font-medium">
                              {profile?.coin_balance ?? 0} {t("nav.coins")}
                            </span>
                            {isVip && (
                              <span className="px-2 py-0.5 rounded-full bg-vip text-white font-semibold inline-flex items-center gap-1">
                                <Crown className="h-3 w-3" /> VIP
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="py-1">
                          {[
                            { to: "/profile", icon: UserIcon, label: "Profile" },
                            { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
                            { to: "/transactions", icon: Receipt, label: "Transaksi" },
                            { to: "/settings", icon: Settings, label: "Pengaturan" },
                          ].map((it) => (
                            <Link
                              key={it.to}
                              to={it.to}
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors"
                            >
                              <it.icon className="h-4 w-4 text-muted-foreground" />
                              {it.label}
                            </Link>
                          ))}
                        </div>
                        <div className="border-t border-border/60 py-1">
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Keluar
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow hover:shadow-warm transition-all"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}

            <button
              className="lg:hidden p-2 rounded-lg hover:bg-accent/50"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden border-t border-border/60"
            >
              <div className="px-4 py-3 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-accent/50"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                ))}
                <div className="flex sm:hidden items-center gap-2 px-3 pt-3 border-t border-border/60">
                  <LanguageToggle />
                  <ThemeToggle />
                  <NotificationsBell />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
