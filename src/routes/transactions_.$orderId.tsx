import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, CreditCard, Loader2, Sparkles, Copy, Receipt, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkTransactionStatus, getMidtransConfig, changeTransactionMethod } from "@/lib/midtrans.functions";
import { loadSnap, openSnap } from "@/lib/midtrans-snap";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import type { PaymentMethodKey } from "@/components/checkout/payment-methods";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/transactions_/$orderId")({ component: TxDetail });

interface Tx {
  id: string; order_id: string; amount_idr: number; coin_amount: number; bonus_coin: number;
  status: string; payment_type: string | null; snap_token: string | null;
  paid_at: string | null; created_at: string; midtrans_response: unknown;
  tx_type?: string;
  meta?: { game?: string; level?: number; tenths?: number; label?: string } | null;
}

const GAME_LABELS: Record<string, string> = {
  flappy: "Flappy BookBird",
  memory: "Memory Match",
  reflex: "Reflex Strike",
  tap: "Target Hunt",
  puzzle: "Number Rush",
};

const STATUS_META: Record<string, { label: string; cls: string; ring: string; icon: typeof CheckCircle2 }> = {
  success: { label: "Berhasil", cls: "text-primary bg-primary/15", ring: "ring-primary/30", icon: CheckCircle2 },
  pending: { label: "Menunggu pembayaran", cls: "text-gold bg-gold/15", ring: "ring-gold/40", icon: Clock },
  failed:  { label: "Gagal", cls: "text-destructive bg-destructive/15", ring: "ring-destructive/30", icon: XCircle },
  expired: { label: "Kadaluarsa", cls: "text-muted-foreground bg-muted", ring: "ring-muted", icon: AlertCircle },
  cancel:  { label: "Dibatalkan", cls: "text-muted-foreground bg-muted", ring: "ring-muted", icon: XCircle },
};

function TxDetail() {
  const { orderId } = Route.useParams();
  const { user, refreshProfile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const checkFn = useServerFn(checkTransactionStatus);
  const cfgFn = useServerFn(getMidtransConfig);
  const changeFn = useServerFn(changeTransactionMethod);
  const [resuming, setResuming] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [newMethod, setNewMethod] = useState<PaymentMethodKey>("qris");
  const [changing, setChanging] = useState(false);

  const q = useQuery({
    enabled: !!user,
    queryKey: ["tx-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("order_id", orderId).maybeSingle();
      if (error) throw error;
      return data as Tx | null;
    },
    refetchInterval: (queryState) => {
      const d = queryState.state.data as Tx | null | undefined;
      return d?.status === "pending" ? 5000 : false;
    },
  });

  // While pending, force-sync from Midtrans every 5s (webhook may be delayed)
  useEffect(() => {
    if (q.data?.status !== "pending") return;
    const sync = () => {
      checkFn({ data: { order_id: orderId } })
        .then((r) => { if (r.status !== "pending") { q.refetch(); refreshProfile(); } })
        .catch(() => { /* silent */ });
    };
    sync();
    const t = setInterval(sync, 5000);
    return () => clearInterval(t);
  }, [q.data?.status, orderId, checkFn, q, refreshProfile]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("tx-" + orderId).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions", filter: `order_id=eq.${orderId}` },
      () => { q.refetch(); refreshProfile(); }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, orderId, q, refreshProfile]);

  const applyFreshStatus = async (r: { status: string; payment_type?: string }) => {
    if (r.status !== "pending") {
      qc.setQueryData<Tx | null>(["tx-detail", orderId], (prev) => prev ? {
        ...prev,
        status: r.status,
        payment_type: r.payment_type ?? prev.payment_type,
        paid_at: r.status === "success" ? (prev.paid_at ?? new Date().toISOString()) : prev.paid_at,
      } : prev);
    }
    await q.refetch();
    await refreshProfile();
    await qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const checkM = useMutation({
    mutationFn: () => checkFn({ data: { order_id: orderId } }),
    onSuccess: async (r) => {
      await applyFreshStatus(r);
      toast.success(r.status === "success" ? "Pembayaran berhasil. Database sudah diperbarui." : `Status: ${r.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resume = async () => {
    if (!q.data?.snap_token) { toast.error("Snap token tidak tersedia."); return; }
    setResuming(true);
    try {
      const cfg = await cfgFn();
      await loadSnap(cfg.client_key, cfg.is_production);
      let snapSuccess = false;
      await new Promise<void>((resolve) => openSnap(q.data!.snap_token!, {
        onSuccess: () => { snapSuccess = true; toast.success("Pembayaran berhasil, menyinkronkan database..."); resolve(); },
        onPending: () => { toast.info("Pembayaran pending."); resolve(); },
        onError: () => { toast.error("Pembayaran gagal."); resolve(); },
        onClose: () => resolve(),
      }));
      const status = await checkFn({ data: { order_id: orderId } });
      await applyFreshStatus(status);
      if (snapSuccess && status.status === "success") toast.success("Database, wallet, dan timeline sudah update.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setResuming(false); }
  };

  const submitChangeMethod = async () => {
    setChanging(true);
    try {
      const r = await changeFn({ data: { order_id: orderId, method: newMethod } });
      toast.success("Metode pembayaran diperbarui.");
      setMethodOpen(false);
      // Open new Snap immediately
      await loadSnap(r.client_key, r.is_production);
      await new Promise<void>((resolve) => openSnap(r.snap_token, {
        onSuccess: () => { toast.success("Pembayaran berhasil."); resolve(); },
        onPending: () => { toast.info("Menunggu pembayaran."); resolve(); },
        onError: () => { toast.error("Pembayaran gagal."); resolve(); },
        onClose: () => resolve(),
      }));
      // Navigate to new transaction detail
      nav({ to: "/transactions/$orderId", params: { orderId: r.order_id }, replace: true });
    } catch (e) { toast.error((e as Error).message); }
    finally { setChanging(false); }
  };

  if (!user) return <div className="mx-auto max-w-md px-4 py-16 text-center glass-strong rounded-3xl p-10"><p>Login dulu. <Link to="/login" className="text-primary">Login</Link></p></div>;
  if (q.isLoading) return <div className="mx-auto max-w-2xl px-6 py-10"><div className="skeleton h-64 rounded-2xl" /></div>;
  if (!q.data) return <div className="text-center py-20 text-muted-foreground">Transaksi tidak ditemukan. <Link to="/transactions" className="text-primary">Kembali</Link></div>;

  const tx = q.data;
  const meta = STATUS_META[tx.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const totalCoin = tx.coin_amount + (tx.bonus_coin ?? 0);
  const isVip = tx.tx_type === "vip_sub" || tx.order_id.startsWith("VIP-");
  const isGameReward = tx.tx_type === "game_reward";
  const gameReward = (tx.meta?.tenths ?? 0) / 10;
  const gameLabel = tx.meta?.game ? (GAME_LABELS[tx.meta.game] ?? tx.meta.game) : "Mini Game";
  const typeLabel = isGameReward ? "Mini Game Reward" : tx.tx_type === "vip_story" ? "Aktivasi Story VIP" : tx.tx_type === "paid_chapter" ? "Aktivasi Chapter Premium" : isVip ? "VIP Subscription" : "Top-up Koin";
  const successLabel = isGameReward ? `+${gameReward.toLocaleString("id-ID", { maximumFractionDigits: 1 })} coin dari ${gameLabel}` : tx.tx_type === "vip_story" ? "Story VIP aktif & terbit 🎉" : tx.tx_type === "paid_chapter" ? "Chapter Premium • 10 Coin aktif" : isVip ? "VIP aktif 👑" : `+${totalCoin} koin masuk!`;
  const fulfillmentLabel = isGameReward ? "Reward game masuk wallet" : tx.tx_type === "vip_story" ? "Story VIP diterbitkan" : tx.tx_type === "paid_chapter" ? "Chapter premium aktif" : isVip ? "VIP aktif" : "Koin ditambahkan";

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => nav({ to: "/wallet" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Wallet
        </button>
        <Link to="/transactions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Receipt className="h-4 w-4" /> Riwayat
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`glass-strong rounded-3xl p-6 sm:p-8 shadow-warm ring-2 ${meta.ring}`}>
        <div className="flex items-start gap-4">
          <motion.div
            initial={tx.status === "success" ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className={`h-14 w-14 rounded-full grid place-items-center ${meta.cls}`}
          >
            <Icon className="h-7 w-7" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{typeLabel}</p>
            <h1 className="font-display text-3xl font-bold mt-0.5">Rp {tx.amount_idr.toLocaleString("id-ID")}</h1>
            <span className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
          </div>
        </div>

        {tx.status === "success" && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl bg-primary/10 p-5 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 font-semibold">{successLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">Database, status, dan akses sudah diperbarui otomatis.</p>
            </motion.div>
          </AnimatePresence>
        )}

        <Timeline status={tx.status} createdAt={tx.created_at} paidAt={tx.paid_at} fulfillmentLabel={fulfillmentLabel} />

        <div className="mt-6 divide-y divide-border/60">
          <Row label="Order ID" value={<span className="inline-flex items-center gap-1.5 font-mono text-xs">{tx.order_id}<button onClick={() => { navigator.clipboard.writeText(tx.order_id); toast.success("Disalin."); }} className="opacity-60 hover:opacity-100"><Copy className="h-3 w-3" /></button></span>} />
          {!isVip && <Row label="Jumlah koin" value={<span>{tx.coin_amount}{tx.bonus_coin ? <span className="text-primary"> +{tx.bonus_coin} bonus</span> : null} koin</span>} />}
          <Row label="Nominal" value={`Rp ${tx.amount_idr.toLocaleString("id-ID")}`} />
          <Row label="Biaya admin" value={<span className="text-muted-foreground">Rp 0</span>} />
          <Row label="Total" value={<span className="font-semibold">Rp {tx.amount_idr.toLocaleString("id-ID")}</span>} />
          <Row label="Metode" value={tx.payment_type ?? "-"} />
          <Row label="Dibuat" value={new Date(tx.created_at).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })} />
          {tx.paid_at && <Row label="Dibayar" value={new Date(tx.paid_at).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })} />}
        </div>

        {tx.status === "pending" && (
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <button onClick={resume} disabled={resuming} className="flex-1 px-5 py-3 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium inline-flex items-center justify-center gap-2 shadow-glow disabled:opacity-60">
              {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Lanjutkan pembayaran
            </button>
            <button onClick={() => setMethodOpen(true)} className="px-5 py-3 rounded-full glass font-medium inline-flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" /> Ubah Metode
            </button>
            <button onClick={() => checkM.mutate()} disabled={checkM.isPending} className="px-5 py-3 rounded-full glass font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {checkM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Cek status
            </button>
          </div>
        )}

        {(tx.status === "failed" || tx.status === "expired" || tx.status === "cancel") && (
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <Link to="/wallet" className="flex-1 px-5 py-3 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium text-center inline-flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4" /> Coba lagi</Link>
            <Link to="/transactions" className="flex-1 px-5 py-3 rounded-full glass font-medium text-center inline-flex items-center justify-center gap-2"><FileText className="h-4 w-4" /> Riwayat</Link>
          </div>
        )}

        {tx.status === "success" && (
          <div className="mt-6 flex gap-2">
            <Link to="/wallet" className="flex-1 px-5 py-3 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium text-center">Buka Wallet</Link>
            <Link to="/explore" className="flex-1 px-5 py-3 rounded-full glass font-medium text-center">Mulai Baca</Link>
          </div>
        )}

        {tx.midtrans_response ? (
          <details className="mt-6">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Lihat raw response Midtrans</summary>
            <pre className="mt-2 text-[10px] glass rounded-xl p-3 overflow-auto max-h-64 font-mono">{JSON.stringify(tx.midtrans_response, null, 2)}</pre>
          </details>
        ) : null}

        {tx.status === "pending" && (
          <p className="mt-4 text-[11px] text-muted-foreground text-center">Status diperbarui otomatis setiap 5 detik & realtime via webhook.</p>
        )}
      </motion.div>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubah Metode Pembayaran</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Transaksi pending akan dibatalkan dan diganti dengan transaksi baru. Total bayar tidak berubah.
          </p>
          <PaymentMethodPicker value={newMethod} onChange={setNewMethod} />
          <DialogFooter>
            <button onClick={() => setMethodOpen(false)} className="px-4 py-2 rounded-full glass text-sm">Batal</button>
            <button onClick={submitChangeMethod} disabled={changing} className="px-5 py-2 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
              {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Lanjutkan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-3 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-all max-w-[60%]">{value}</span>
    </div>
  );
}

function Timeline({ status, createdAt, paidAt, fulfillmentLabel }: { status: string; createdAt: string; paidAt: string | null; fulfillmentLabel: string }) {
  const isDone = status === "success";
  const isFailed = status === "failed" || status === "expired" || status === "cancel";
  const steps = [
    { label: "Transaksi dibuat", done: true, time: createdAt },
    { label: "Menunggu pembayaran", done: isDone || status === "pending", active: status === "pending" && !isFailed, time: null as string | null },
    { label: "Pembayaran diterima", done: isDone, time: paidAt },
    { label: fulfillmentLabel, done: isDone, time: paidAt },
  ];
  return (
    <div className="mt-6 rounded-2xl glass p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Timeline</p>
      <ol className="relative space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="relative flex flex-col items-center">
              <div className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                isFailed && i > 0 ? "bg-destructive/15 text-destructive" :
                s.done ? "bg-primary text-primary-foreground" :
                s.active ? "bg-gold/20 text-gold animate-pulse" : "bg-muted text-muted-foreground"
              }`}>
                {isFailed && i > 0 ? "✕" : s.done ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-px flex-1 mt-1 ${s.done ? "bg-primary/40" : "bg-border"}`} style={{ minHeight: 12 }} />}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className={`text-sm ${s.done ? "font-medium" : "text-muted-foreground"}`}>{s.label}</p>
              {s.time && <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(s.time).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}