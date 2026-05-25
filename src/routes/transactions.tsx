import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/transactions")({ component: TxPage });

interface Transaction {
  id: string;
  order_id: string;
  amount_idr: number;
  coin_amount: number;
  bonus_coin: number;
  status: string;
  payment_type: string | null;
  paid_at: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  success: { label: "Berhasil", cls: "text-primary bg-primary/15", icon: CheckCircle2 },
  pending: { label: "Pending", cls: "text-gold bg-gold/15", icon: Clock },
  failed:  { label: "Gagal",   cls: "text-destructive bg-destructive/15", icon: XCircle },
  expired: { label: "Expired", cls: "text-muted-foreground bg-muted", icon: AlertCircle },
  cancel:  { label: "Dibatalkan", cls: "text-muted-foreground bg-muted", icon: XCircle },
};

function TxPage() {
  const { user } = useAuth();

  const txQ = useQuery({
    enabled: !!user,
    queryKey: ["my-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("tx-page-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        () => txQ.refetch()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, txQ]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl font-semibold flex items-center gap-3"><Receipt className="h-8 w-8 text-primary" /> Transactions</h1>
        <p className="mt-2 text-muted-foreground">Riwayat top-up, unlock chapter, dan withdraw.</p>
      </motion.div>

      {!user ? (
        <div className="mt-8 glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Login untuk melihat riwayat. <Link to="/login" className="text-primary">Login →</Link>
        </div>
      ) : txQ.isLoading ? (
        <div className="mt-8 space-y-2">{[1,2,3].map(i=><div key={i} className="skeleton h-20 rounded-xl"/>)}</div>
      ) : !txQ.data?.length ? (
        <div className="mt-8 glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Belum ada transaksi. <Link to="/wallet" className="text-primary">Top up sekarang →</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {txQ.data.map((t) => {
            const meta = STATUS_META[t.status] ?? STATUS_META.pending;
            const Icon = meta.icon;
            const total = t.coin_amount + (t.bonus_coin ?? 0);
            return (
              <li key={t.id}>
              <Link to="/transactions/$orderId" params={{ orderId: t.order_id }} className="glass rounded-2xl p-4 flex items-center gap-4 flex-wrap hover-lift hover:bg-accent/30 transition-colors">
                <div className={`h-10 w-10 rounded-full grid place-items-center ${meta.cls}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">+{total} koin {t.bonus_coin > 0 && <span className="text-xs text-primary">({t.coin_amount}+{t.bonus_coin})</span>}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(t.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    {t.payment_type ? ` · ${t.payment_type}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-semibold">Rp {t.amount_idr.toLocaleString("id-ID")}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                </div>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
