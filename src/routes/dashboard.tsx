import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Coins,
  Eye,
  Heart,
  BookOpen,
  TrendingUp,
  Wallet,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Crown,
  ImageIcon,
} from "lucide-react";
import { getAuthorDashboard } from "@/lib/economy.functions";
import { useAuth } from "@/hooks/use-auth";
import { WithdrawDialog, formatIDR } from "@/components/WithdrawDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

const COIN_TO_IDR = 100;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
        accent
          ? "border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
          : "border-border/60 bg-card/60 backdrop-blur"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl ${
            accent ? "bg-primary/15 text-primary" : "bg-muted/60 text-foreground/70"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl sm:text-3xl font-semibold leading-none truncate">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
    approved: { label: "Disetujui", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: CheckCircle2 },
    paid: { label: "Sukses", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
    rejected: { label: "Ditolak", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  };
  const it = map[status] ?? map.pending;
  const Icon = it.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${it.cls}`}>
      <Icon className="h-3 w-3" />
      {it.label}
    </span>
  );
}

function DashboardPage() {
  const { user, loading } = useAuth();
  const fetchDashboard = useServerFn(getAuthorDashboard);
  const q = useQuery({
    queryKey: ["author-dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: !!user,
  });
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (loading || (user && q.isLoading)) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-4">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Link to="/login" className="text-primary">Login dulu</Link>
      </div>
    );
  }

  const d = q.data!;
  const balance = Number(d.earnings.balance ?? 0);
  const totalEarned = Number(d.earnings.total_earned ?? 0);
  const withdrawn = Number(d.earnings.withdrawn ?? 0);
  const totalViews = d.stories.reduce((a, s) => a + (s.views || 0), 0);
  const totalLikes = d.stories.reduce((a, s) => a + (s.likes_count || 0), 0);
  const totalUnlocks = d.stories.reduce((a, s) => a + (s.unlock_count || 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" /> Creator Studio
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold mt-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau performa karyamu dan tarik penghasilan kapan saja.
          </p>
        </div>
      </motion.div>

      {/* Earnings hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6 relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-7"
      >
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-primary-glow/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Saldo earning</p>
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-4xl sm:text-5xl font-bold text-gradient-warm break-all">
                {balance.toLocaleString("id-ID")}
              </span>
              <span className="text-sm text-muted-foreground">coin</span>
            </div>
            <p className="mt-1 text-sm text-foreground/80">≈ {formatIDR(balance * COIN_TO_IDR)}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Total: {totalEarned.toLocaleString("id-ID")} coin</span>
              <span>Ditarik: {withdrawn.toLocaleString("id-ID")} coin</span>
            </div>
          </div>

          <Button
            onClick={() => setWithdrawOpen(true)}
            disabled={balance < 500}
            className="h-11 px-6 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow w-full sm:w-auto"
          >
            <Wallet className="h-4 w-4" /> Tarik dana
          </Button>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <StatCard icon={BookOpen} label="Cerita" value={d.stories.length} accent />
        <StatCard icon={Eye} label="Views" value={totalViews.toLocaleString("id-ID")} />
        <StatCard icon={Heart} label="Likes" value={totalLikes.toLocaleString("id-ID")} />
        <StatCard icon={Coins} label="Unlocks" value={totalUnlocks.toLocaleString("id-ID")} />
      </motion.section>

      {/* Stories */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-8"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Karya kamu
          </h2>
          <Link to="/write" className="text-xs text-primary hover:underline">
            + Cerita baru
          </Link>
        </div>

        {d.stories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            Belum ada cerita.{" "}
            <Link to="/write" className="text-primary hover:underline">
              Mulai menulis →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {d.stories.map((s) => {
              const gradient = s.cover_gradient ?? "var(--gradient-warm)";
              const isDraft = s.status !== "published";
              return (
                <Link
                  key={s.id}
                  to="/story/$slug"
                  params={{ slug: s.slug }}
                  className="group flex flex-col rounded-2xl border border-border/60 bg-card/60 overflow-hidden hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div
                    className="relative aspect-[2/3] w-full overflow-hidden"
                    style={{ background: gradient }}
                  >
                    {s.cover_url ? (
                      <img
                        src={s.cover_url}
                        alt={s.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="flex flex-col items-center gap-1.5 text-primary-foreground/80">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-[10px] uppercase tracking-widest font-semibold">
                            No cover
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-90" />
                    <div className="absolute top-2 left-2 right-2 flex justify-between gap-1">
                      {s.is_vip ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-vip/90 text-white text-[9px] font-bold uppercase tracking-wider shadow">
                          <Crown className="h-2.5 w-2.5" /> VIP
                        </span>
                      ) : (
                        <span />
                      )}
                      {isDraft && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white text-[9px] font-bold uppercase tracking-wider shadow">
                          Draft
                        </span>
                      )}
                      {!isDraft && !s.is_vip && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-bold uppercase tracking-wider shadow">
                          Live
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {(s.views ?? 0).toLocaleString("id-ID")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {(s.likes_count ?? 0).toLocaleString("id-ID")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        {(s.unlock_count ?? 0).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5em]">
                      {s.title}
                    </p>
                    {s.genre && (
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                        {s.genre}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* Two-column lower section */}
      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        {/* Recent unlocks */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Aktivitas unlock
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
            {d.recent_unlocks.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Belum ada unlock.</p>
            ) : (
              <ul className="divide-y divide-border/60 max-h-80 overflow-y-auto">
                {d.recent_unlocks.slice(0, 12).map((u) => (
                  <li key={u.id} className="px-4 py-3 flex items-center justify-between text-sm gap-3">
                    <span className="text-xs text-muted-foreground truncate">
                      {new Date(u.created_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary shrink-0">
                      <Coins className="h-3.5 w-3.5" />+{Number(u.author_share).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>

        {/* Withdrawals */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Riwayat withdraw
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
            {d.withdrawals.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Belum pernah withdraw.</p>
            ) : (
              <ul className="divide-y divide-border/60 max-h-80 overflow-y-auto">
                {d.withdrawals.map((w) => {
                  const idr = (w.amount_coin ?? 0) * COIN_TO_IDR;
                  return (
                    <li key={w.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {Number(w.amount_coin).toLocaleString("id-ID")} coin
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-primary">{formatIDR(idr)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {(w.method ?? "").toUpperCase()} ·{" "}
                          {new Date(w.created_at).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <StatusBadge status={w.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.section>
      </div>

      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} balance={balance} />
    </div>
  );
}
