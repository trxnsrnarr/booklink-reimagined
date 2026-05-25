import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, X, Check } from "lucide-react";
import { listPendingWithdrawals, processWithdrawal } from "@/lib/economy.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/withdrawals")({ component: AdminWithdrawals });

function AdminWithdrawals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listPendingWithdrawals);
  const process = useServerFn(processWithdrawal);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const q = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => fetchAll(), enabled: !!user });

  const m = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "paid"; note?: string }) =>
      process({ data: v }),
    onSuccess: () => { toast.success("Diproses."); setNoteFor(null); setNote(""); qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return <div className="mx-auto max-w-md px-4 py-16 text-center"><Link to="/login" className="text-primary">Login</Link></div>;

  const all = q.data?.withdrawals ?? [];
  const pending = all.filter((w) => w.status === "pending");
  const done = all.filter((w) => w.status !== "pending");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-6"><ShieldCheck className="h-5 w-5 text-primary" /><h1 className="font-display text-3xl font-semibold">Admin · Withdrawals</h1></div>

      {q.isLoading ? <div className="skeleton h-32 rounded-2xl" /> : all.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <p>Tidak ada data, atau kamu bukan admin.</p>
          <p className="text-xs mt-2">Tambahkan role <code>admin</code> di tabel <code>user_roles</code> untuk akun ini.</p>
        </div>
      ) : (
        <>
          <section>
            <h2 className="font-display text-xl font-semibold mb-3">Pending ({pending.length})</h2>
            <div className="space-y-2">
              {pending.length === 0 && <p className="text-sm text-muted-foreground glass rounded-xl p-4">Tidak ada pending.</p>}
              {pending.map((w) => {
                const info = (w.account_info ?? {}) as { account_name?: string; account_number?: string; bank_name?: string };
                return (
                  <div key={w.id} className="glass-strong rounded-2xl p-4">
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <div className="text-sm">
                        <p className="font-semibold">{w.amount_coin} coin · {w.method.toUpperCase()}</p>
                        <p className="text-muted-foreground">{info.account_name} — {info.account_number} {info.bank_name ? `(${info.bank_name})` : ""}</p>
                        <p className="text-[11px] text-muted-foreground">User: {w.user_id} · {new Date(w.created_at).toLocaleString("id-ID")}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => m.mutate({ id: w.id, status: "approved" })} className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />Approve</button>
                        <button onClick={() => m.mutate({ id: w.id, status: "paid" })} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm">Mark paid</button>
                        <button onClick={() => { setNoteFor(w.id); setNote(""); }} className="px-3 py-1.5 rounded-full bg-destructive/20 text-destructive text-sm inline-flex items-center gap-1"><X className="h-3.5 w-3.5" />Reject</button>
                      </div>
                    </div>
                    {noteFor === w.id && (
                      <div className="mt-3 flex gap-2">
                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan ditolak" className="flex-1 px-3 py-2 rounded-lg bg-input/60 border border-border text-sm" />
                        <button onClick={() => m.mutate({ id: w.id, status: "rejected", note })} disabled={!note.trim()} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm">Tolak</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold mb-3">Riwayat ({done.length})</h2>
            <div className="space-y-2">
              {done.map((w) => (
                <div key={w.id} className="glass rounded-xl p-3 text-sm flex items-center justify-between">
                  <span>{w.amount_coin} coin · {w.method} · {new Date(w.created_at).toLocaleDateString("id-ID")}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>{w.status}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
