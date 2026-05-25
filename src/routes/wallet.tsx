import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coins, Sparkles, Crown, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { supabase } from "@/integrations/supabase/client";
import { getAuthorDashboard } from "@/lib/economy.functions";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

const VIP_PLANS = [
  { plan: "monthly" as const, name: "Monthly", price: 49000, period: "/bulan" },
  { plan: "yearly" as const, name: "Yearly", price: 449000, period: "/tahun", best: true },
];

interface CoinPackage { id: string; name: string; coin_amount: number; bonus_coin: number; price_idr: number; is_popular: boolean; sort_order: number; }

function WalletPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchDash = useServerFn(getAuthorDashboard);

  const packagesQ = useQuery({
    queryKey: ["coin-packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_packages").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as CoinPackage[];
    },
  });

  const dashQ = useQuery({ queryKey: ["author-dashboard"], queryFn: () => fetchDash(), enabled: !!user });
  const earnings = dashQ.data?.earnings;

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("wallet-tx-" + user.id).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
      (payload) => {
        const newStatus = (payload.new as { status?: string })?.status;
        const txType = (payload.new as { tx_type?: string })?.tx_type;
        if (newStatus === "success") {
          if (txType === "game_reward") toast.success("Reward game masuk ke wallet.");
          else toast.success("Pembayaran sukses! Saldo diperbarui.");
          refreshProfile(); qc.invalidateQueries({ queryKey: ["author-dashboard"] });
        }
        qc.invalidateQueries({ queryKey: ["my-transactions"] });
      }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc, refreshProfile]);

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
      <Coins className="mx-auto h-12 w-12 text-primary" />
      <h1 className="mt-4 font-display text-2xl font-semibold">{t("nav.wallet")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Login untuk mengakses wallet.</p>
      <Link to="/login" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow">{t("nav.login")}</Link>
    </div>
  );

  const isVip = profile?.vip_until && new Date(profile.vip_until) > new Date();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold">{t("nav.wallet")}</h1>
        <p className="mt-2 text-muted-foreground">Top up koin, jadi VIP, atau klaim reward.</p>

        <div className="mt-8 glass-strong rounded-3xl p-6 sm:p-8 shadow-warm relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-gold/30 to-primary/20 blur-3xl" />
          <div className="relative grid sm:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">Saldo koin {isVip && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-vip text-white text-[10px] font-bold"><Crown className="h-3 w-3" />VIP</span>}</p>
              <motion.p key={profile?.coin_balance} initial={{ scale: 1.1, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="mt-2 font-display text-5xl sm:text-6xl font-bold text-gradient-warm">{profile?.coin_balance ?? 0}</motion.p>
              <p className="text-sm text-muted-foreground mt-1">BookLink Coins</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link to="/transactions" className="px-5 py-2.5 rounded-full glass font-medium inline-flex items-center gap-2 text-sm">Riwayat transaksi →</Link>
              <Link to="/withdraw" className="px-5 py-2.5 rounded-full glass font-medium inline-flex items-center gap-2 text-sm"><WalletIcon className="h-4 w-4" />Withdraw earnings</Link>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /> Paket Koin</h2>
          {packagesQ.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[1,2,3,4,5].map(i=><div key={i} className="skeleton h-32 rounded-2xl"/>)}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {packagesQ.data?.map((p) => (
                <button
                  key={p.id}
                  onClick={() => nav({ to: "/checkout/$packageId", params: { packageId: p.id } })}
                  className={`relative glass rounded-2xl p-4 sm:p-5 text-left hover:bg-accent/30 transition-all hover-lift ${p.is_popular ? "ring-2 ring-primary" : ""}`}
                >
                  {p.is_popular && <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-[10px] font-bold uppercase">Popular</span>}
                  <p className="text-xs text-muted-foreground">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-1"><Coins className="h-5 w-5 text-gold" /><p className="font-display text-2xl font-bold">{p.coin_amount}</p></div>
                  {p.bonus_coin > 0 && <p className="text-[11px] text-primary mt-0.5">+{p.bonus_coin} bonus</p>}
                  <p className="mt-3 text-sm font-semibold">Rp {p.price_idr.toLocaleString("id-ID")}</p>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Metode: QRIS · Gopay · ShopeePay · DANA · Virtual Account · Bank Transfer.</p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2"><Crown className="h-5 w-5 text-vip" /> VIP Subscription</h2>
          {isVip ? (
            <div className="glass-strong rounded-2xl p-6 ring-2 ring-vip flex items-center gap-4 flex-wrap">
              <Crown className="h-10 w-10 text-vip" />
              <div className="flex-1 min-w-[200px]">
                <p className="font-display text-lg font-semibold">Kamu sudah VIP 👑</p>
                <p className="text-sm text-muted-foreground">Aktif sampai <strong>{new Date(profile!.vip_until!).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong>. Tidak bisa beli ulang sebelum expired.</p>
                <p className="mt-2 text-sm">VIP Story Unlock: <strong>{Math.max((profile?.vip_unlock_limit ?? 8) - (profile?.vip_unlock_used ?? 0), 0)} / {profile?.vip_unlock_limit ?? 8} Remaining</strong></p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {VIP_PLANS.map((p) => (
                <button key={p.plan} onClick={() => nav({ to: "/checkout/vip/$plan", params: { plan: p.plan } })} className={`relative glass-strong rounded-2xl p-6 text-left hover-lift transition-all ${p.best ? "ring-2 ring-vip shadow-glow" : ""}`}>
                  {p.best && <span className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-vip text-white text-[10px] font-bold uppercase">Best Value</span>}
                  <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-vip" /><p className="font-display text-xl font-semibold">{p.name}</p></div>
                  <p className="mt-3 font-display text-3xl font-bold">Rp {p.price.toLocaleString("id-ID")}<span className="text-sm font-normal text-muted-foreground">{p.period}</span></p>
                  <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    <li>✓ 8 unlock VIP story per bulan</li>
                    <li>✓ Bebas baca semua chapter story ter-unlock</li>
                    <li>✓ Badge VIP 👑 di profil</li>
                    <li>✓ Reset otomatis tiap perpanjangan</li>
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">Chapter premium tetap dibayar dengan koin.</p>
                </button>
              ))}
            </div>
          )}

        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Author Earnings</h2>
            <button onClick={() => nav({ to: "/dashboard" })} className="text-xs text-primary hover:underline">Buka dashboard →</button>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="font-display text-2xl font-bold">{Number(earnings?.balance ?? 0).toFixed(1)}</p><p className="text-xs text-muted-foreground mt-1">Saldo (coin)</p></div>
              <div><p className="font-display text-2xl font-bold">{Number(earnings?.total_earned ?? 0).toFixed(1)}</p><p className="text-xs text-muted-foreground mt-1">Total earned</p></div>
              <div><p className="font-display text-2xl font-bold">{Number(earnings?.withdrawn ?? 0).toFixed(1)}</p><p className="text-xs text-muted-foreground mt-1">Ditarik</p></div>
            </div>
            <Link to="/withdraw" className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium w-full"><WalletIcon className="h-4 w-4" />Withdraw</Link>
          </div>
        </section>

        <div className="mt-10 glass rounded-2xl p-5 text-sm text-muted-foreground flex items-center gap-2 justify-center text-center">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          Pembayaran QRIS, e-wallet, dan VA — diproses realtime via Midtrans.
        </div>
      </motion.div>
    </div>
  );
}
