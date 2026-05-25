import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

function ResetPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-handles recovery hash to create a temporary session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Password tidak cocok."); return; }
    if (password.length < 8) { toast.error("Password minimal 8 karakter."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    toast.success("Password berhasil diperbarui!");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8 shadow-warm">
        {done ? (
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">Password diperbarui</h1>
            <Link to="/login" className="mt-6 inline-block text-primary hover:underline text-sm">Login sekarang</Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold text-center">Reset password</h1>
            {!ready && (
              <p className="mt-3 text-xs text-center text-muted-foreground">
                Buka halaman ini dari link email reset password.
              </p>
            )}
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password baru" className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Konfirmasi password" className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <button disabled={loading || !ready} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow disabled:opacity-60">
                {loading ? "Menyimpan..." : "Update Password"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
