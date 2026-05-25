import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createStoryVipPayment } from "@/lib/midtrans.functions";
import { loadSnap, openSnap } from "@/lib/midtrans-snap";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/components/checkout/payment-methods";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";

export const Route = createFileRoute("/checkout/story-vip/$storyId")({ component: CheckoutStoryVip });

const PRICE = 15000;

function CheckoutStoryVip() {
  const { storyId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const pay = useServerFn(createStoryVipPayment);
  const [method, setMethod] = useState<PaymentMethodKey>("qris");
  const [busy, setBusy] = useState(false);

  const storyQ = useQuery({
    queryKey: ["checkout-story-vip", storyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stories").select("id, title, cover_url, vip_payment_status, author_id").eq("id", storyId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const res = await pay({ data: { story_id: storyId, method } });
      await loadSnap(res.client_key, res.is_production);
      await new Promise<void>((resolve) => openSnap(res.snap_token, {
        onSuccess: () => { toast.success("Aktivasi VIP cerita sukses!"); resolve(); },
        onPending: () => { toast.info("Menunggu pembayaran."); resolve(); },
        onError: () => { toast.error("Pembayaran gagal."); resolve(); },
        onClose: () => resolve(),
      }));
      nav({ to: "/transactions/$orderId", params: { orderId: res.order_id } });
    },
    onSettled: () => setBusy(false),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10"><p>Login dulu.</p><Link to="/login" className="mt-4 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">Login</Link></div>;
  if (storyQ.isLoading) return <div className="mx-auto max-w-4xl px-6 py-10"><div className="skeleton h-96 rounded-3xl" /></div>;
  if (!storyQ.data || storyQ.data.author_id !== user.id) return <div className="text-center py-20 text-muted-foreground">Akses ditolak.</div>;
  const story = storyQ.data;
  if (story.vip_payment_status === "success") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Sudah dibayar</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cerita ini sudah aktif sebagai VIP.</p>
        <Link to="/write/$storyId" params={{ storyId }} className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">Kembali ke editor</Link>
      </div>
    );
  }
  const selected = PAYMENT_METHODS.find(m => m.key === method)!;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <button onClick={() => nav({ to: "/write/$storyId", params: { storyId } })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali ke editor
      </button>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">Aktivasi VIP Cerita</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pilih metode untuk membayar aktivasi cerita VIP kamu.</p>

          <div className="mt-6 glass-strong rounded-3xl p-6 relative overflow-hidden ring-2 ring-vip/40">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-vip/30 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-vip/20 grid place-items-center shadow-glow shrink-0">
                <Crown className="h-8 w-8 text-vip" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest text-vip">Aktivasi sekali bayar</p>
                <h2 className="font-display text-2xl font-bold truncate">{story.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Setelah pembayaran sukses, cerita boleh dipublish sebagai VIP.</p>
              </div>
            </div>
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
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Aktivasi VIP cerita</span><span>Rp {PRICE.toLocaleString("id-ID")}</span></div>
              <div className="border-t border-border/60 pt-3 mt-1 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl font-bold text-vip">Rp {PRICE.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl glass p-3">
                <selected.Icon className="h-4 w-4 text-primary shrink-0" /> Dibayar via <strong>{selected.label}</strong>
              </div>
            </div>
            <button onClick={() => start.mutate()} disabled={busy} className="mt-5 w-full px-5 py-3 rounded-full bg-vip text-white font-semibold inline-flex items-center justify-center gap-2 shadow-glow disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Lanjut Pembayaran
            </button>
            <p className="mt-3 text-[11px] text-center text-muted-foreground">Dijamin aman oleh Midtrans</p>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
