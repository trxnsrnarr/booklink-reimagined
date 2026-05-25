import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Gem, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createChapterPaidPayment } from "@/lib/midtrans.functions";
import { loadSnap, openSnap } from "@/lib/midtrans-snap";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/components/checkout/payment-methods";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";

export const Route = createFileRoute("/checkout/chapter-paid/$chapterId")({ component: CheckoutChapterPaid });

const PRICE = 2000;

function CheckoutChapterPaid() {
  const { chapterId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const pay = useServerFn(createChapterPaidPayment);
  const [method, setMethod] = useState<PaymentMethodKey>("qris");
  const [busy, setBusy] = useState(false);

  const chQ = useQuery({
    queryKey: ["checkout-chapter-paid", chapterId],
    queryFn: async () => {
      const { data: ch, error } = await supabase.from("chapters").select("id, title, story_id, chapter_payment_status").eq("id", chapterId).maybeSingle();
      if (error) throw error;
      if (!ch) return null;
      const { data: story } = await supabase.from("stories").select("id, title, author_id").eq("id", ch.story_id).maybeSingle();
      return { chapter: ch, story };
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const res = await pay({ data: { chapter_id: chapterId, method } });
      await loadSnap(res.client_key, res.is_production);
      await new Promise<void>((resolve) => openSnap(res.snap_token, {
        onSuccess: () => { toast.success("Pembayaran berhasil, mengaktifkan Premium • 10 Coin..."); resolve(); },
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
  if (chQ.isLoading) return <div className="mx-auto max-w-4xl px-6 py-10"><div className="skeleton h-96 rounded-3xl" /></div>;
  if (!chQ.data || !chQ.data.story || chQ.data.story.author_id !== user.id) return <div className="text-center py-20 text-muted-foreground">Akses ditolak.</div>;
  const { chapter, story } = chQ.data;
  if (chapter.chapter_payment_status === "success") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Sudah dibayar</h1>
        <p className="mt-2 text-sm text-muted-foreground">Chapter ini sudah aktif sebagai chapter berbayar.</p>
        <Link to="/write/$storyId" params={{ storyId: story.id }} className="mt-6 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">Kembali ke editor</Link>
      </div>
    );
  }
  const selected = PAYMENT_METHODS.find(m => m.key === method)!;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <button onClick={() => nav({ to: "/write/$storyId", params: { storyId: story.id } })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali ke editor
      </button>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">Aktivasi Chapter Berbayar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pilih metode untuk mengaktifkan chapter ini sebagai Premium • 10 Coin.</p>

          <div className="mt-6 glass-strong rounded-3xl p-6 relative overflow-hidden ring-2 ring-gold/40">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/30 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gold/20 grid place-items-center shadow-glow shrink-0">
                <Coins className="h-8 w-8 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest text-gold">Premium • 10 Coin</p>
                <h2 className="font-display text-2xl font-bold truncate">{chapter.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">dari "{story.title}"</p>
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
            <h3 className="font-display text-lg font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold" /> Ringkasan</h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground inline-flex items-center gap-1.5"><Gem className="h-3.5 w-3.5 text-gold" /> Aktivasi Premium • 10 Coin</span><span>Rp {PRICE.toLocaleString("id-ID")}</span></div>
              <div className="border-t border-border/60 pt-3 mt-1 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl font-bold text-gold">Rp {PRICE.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl glass p-3">
                <selected.Icon className="h-4 w-4 text-primary shrink-0" /> Dibayar via <strong>{selected.label}</strong>
              </div>
            </div>
            <button onClick={() => start.mutate()} disabled={busy} className="mt-5 w-full px-5 py-3 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-glow disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Lanjut Pembayaran
            </button>
            <p className="mt-3 text-[11px] text-center text-muted-foreground">Dijamin aman oleh Midtrans</p>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
