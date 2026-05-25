import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { createVipTransaction } from "@/lib/midtrans.functions";
import { loadSnap, openSnap } from "@/lib/midtrans-snap";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/components/checkout/payment-methods";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";

export const Route = createFileRoute("/checkout/vip/$plan")({ component: CheckoutVip });

const PLANS = {
  monthly: { label: "VIP Monthly", price: 49000, months: 1 },
  yearly:  { label: "VIP Yearly",  price: 449000, months: 12 },
} as const;

function CheckoutVip() {
  const { plan } = Route.useParams();
  const planKey = (plan === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
  const info = PLANS[planKey];
  const { user } = useAuth();
  const nav = useNavigate();
  const vipBuy = useServerFn(createVipTransaction);
  const [method, setMethod] = useState<PaymentMethodKey>("qris");
  const [busy, setBusy] = useState(false);

  const pay = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const res = await vipBuy({ data: { plan: planKey, method } });
      await loadSnap(res.client_key, res.is_production);
      await new Promise<void>((resolve) => openSnap(res.snap_token, {
        onSuccess: () => { toast.success("VIP aktif!"); resolve(); },
        onPending: () => { toast.info("Menunggu pembayaran."); resolve(); },
        onError: () => { toast.error("Pembayaran gagal."); resolve(); },
        onClose: () => resolve(),
      }));
      nav({ to: "/transactions/$orderId", params: { orderId: res.order_id } });
    },
    onSettled: () => setBusy(false),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
      <p>Login dulu untuk checkout.</p>
      <Link to="/login" className="mt-4 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">Login</Link>
    </div>
  );

  const selected = PAYMENT_METHODS.find(m => m.key === method)!;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <button onClick={() => nav({ to: "/wallet" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Wallet
      </button>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">Checkout VIP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aktifkan keanggotaan premium kamu.</p>

          <div className="mt-6 glass-strong rounded-3xl p-6 relative overflow-hidden ring-2 ring-vip/40">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-vip/30 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-vip/20 grid place-items-center shadow-glow">
                <Crown className="h-8 w-8 text-vip" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest text-vip">Premium Membership</p>
                <h2 className="font-display text-2xl font-bold">{info.label}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{info.months} bulan akses VIP</p>
              </div>
            </div>
            <ul className="mt-5 grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-vip" /> Diskon 20% unlock</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-vip" /> Tema eksklusif</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-vip" /> Bonus 100 koin</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-vip" /> Badge VIP</li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="font-display text-lg font-semibold mb-3">Metode pembayaran</h3>
            <PaymentMethodPicker value={method} onChange={setMethod} />
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong rounded-3xl p-6 shadow-warm">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-vip" /> Ringkasan</h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <Row label={info.label} value={`Rp ${info.price.toLocaleString("id-ID")}`} />
              <Row label="Durasi" value={`${info.months} bulan`} />
              <Row label="Biaya admin" value={<span className="text-muted-foreground">Rp 0</span>} />
              <div className="border-t border-border/60 pt-3 mt-1 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl font-bold text-vip">Rp {info.price.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl glass p-3">
                <selected.Icon className="h-4 w-4 text-primary shrink-0" /> Dibayar via <strong>{selected.label}</strong>
              </div>
            </div>
            <button onClick={() => pay.mutate()} disabled={busy} className="mt-5 w-full px-5 py-3 rounded-full bg-vip text-white font-semibold inline-flex items-center justify-center gap-2 shadow-glow disabled:opacity-60 hover:scale-[1.01] transition-transform">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Lanjut Pembayaran
            </button>
            <p className="mt-3 text-[11px] text-center text-muted-foreground">Dijamin aman oleh Midtrans</p>
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