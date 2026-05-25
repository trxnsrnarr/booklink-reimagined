import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8 shadow-warm">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">Email terkirim</h1>
            <p className="mt-2 text-sm text-muted-foreground">Cek inbox untuk link reset password.</p>
            <Link to="/login" className="mt-6 inline-block text-primary hover:underline text-sm">Kembali ke login</Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold text-center">Lupa password?</h1>
            <p className="mt-2 text-sm text-muted-foreground text-center">Masukkan email, kami kirim link reset.</p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow disabled:opacity-60">
                {loading ? "Mengirim..." : "Kirim link reset"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">Kembali ke login</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
