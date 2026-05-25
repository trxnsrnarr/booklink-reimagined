import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createTopupTransaction } from "@/lib/midtrans.functions";
import { loadSnap, openSnap } from "@/lib/midtrans-snap";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/components/checkout/payment-methods";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";

export const Route = createFileRoute("/checkout/$packageId")({ component: CheckoutCoin });

interface CoinPackage {
  id: string; name: string; coin_amount: number; bonus_coin: number; price_idr: number; is_popular: boolean;
}

function CheckoutCoin() {
  const { packageId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const topup = useServerFn(createTopupTransaction);
  const [method, setMethod] = useState<PaymentMethodKey>("qris");
  const [busy, setBusy] = useState(false);

  const pkgQ = useQuery({
    queryKey: ["coin-package", packageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_packages").select("*").eq("id", packageId).maybeSingle();
      if (error) throw error;
      return data as CoinPackage | null;
    },
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!pkgQ.data) throw new Error("Paket tidak ditemukan");
      setBusy(true);
      const res = await topup({ data: { package_id: pkgQ.data.id, method } });
      await loadSnap(res.client_key, res.is_production);
      await new Promise<void>((resolve) => openSnap(res.snap_token, {
        onSuccess: () => { toast.success("Pembayaran berhasil!"); resolve(); },
        onPending: () => { toast.info("Menunggu pembayaran."); resolve(); },
        onError: () => { toast.error("Pembayaran gagal."); resolve(); },
        onClose: () => resolve(),
      }));
      nav({ to: "/transactions/$orderId", params: { orderId: res.order_id } });
    },
    onSettled: () => setBusy(false),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return <RequireLogin />;
  if (pkgQ.isLoading) return <div className="mx-auto max-w-4xl px-6 py-10"><div className="skeleton h-96 rounded-3xl" /></div>;
  if (!pkgQ.data) return <NotFound />;

  const pkg = pkgQ.data;
  const totalCoin = pkg.coin_amount + (pkg.bonus_coin ?? 0);
  const selected = PAYMENT_METHODS.find(m => m.key === method)!;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <button onClick={() => nav({ to: "/wallet" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Wallet
      </button>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pilih metode pembayaran untuk top-up koin kamu.</p>

          <div className="mt-6 glass-strong rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-gold/30 to-primary/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gold/30 to-primary/20 grid place-items-center shadow-glow">
                <Coins className="h-8 w-8 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Paket Koin</p>
                <h2 className="font-display text-2xl font-bold">{pkg.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{pkg.coin_amount} koin{pkg.bonus_coin ? <span className="text-primary"> + {pkg.bonus_coin} bonus</span> : null}</p>
              </div>
              {pkg.is_popular && <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-[10px] font-bold uppercase">Popular</span>}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-display text-lg font-semibold mb-3">Metode pembayaran</h3>
            <PaymentMethodPicker value={method} onChange={setMethod} />
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong rounded-3xl p-6 shadow-warm">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Ringkasan</h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <Row label={pkg.name} value={`Rp ${pkg.price_idr.toLocaleString("id-ID")}`} />
              <Row label="Koin" value={`${pkg.coin_amount}`} />
              {pkg.bonus_coin > 0 && <Row label="Bonus koin" value={<span className="text-primary">+{pkg.bonus_coin}</span>} />}
              <Row label="Biaya admin" value={<span className="text-muted-foreground">Rp 0</span>} />
              <div className="border-t border-border/60 pt-3 mt-1 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl font-bold text-gradient-warm">Rp {pkg.price_idr.toLocaleString("id-ID")}</span>
              </div>
              <div className="rounded-xl bg-primary/5 p-3 flex items-center gap-2 text-xs text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Kamu akan menerima <strong>{totalCoin}</strong> koin
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl glass p-3">
                <selected.Icon className="h-4 w-4 text-primary shrink-0" /> Dibayar via <strong>{selected.label}</strong>
              </div>
            </div>

            <button
              onClick={() => pay.mutate()}
              disabled={busy}
              className="mt-5 w-full px-5 py-3 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-glow disabled:opacity-60 hover:scale-[1.01] transition-transform"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Lanjut Pembayaran
            </button>
            <p className="mt-3 text-[11px] text-center text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
              <ShieldCheck className="h-3 w-3" /> Dijamin aman oleh Midtrans
            </p>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function RequireLogin() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
      <p>Login dulu untuk checkout.</p>
      <Link to="/login" className="mt-4 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">Login</Link>
    </div>
  );
}
function NotFound() {
  return <div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">Paket tidak ditemukan. <Link to="/wallet" className="text-primary">Kembali</Link></div>;
}