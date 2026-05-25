import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/" }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: to } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("email") && error.message.toLowerCase().includes("confirm")) {
        toast.error("Email belum diverifikasi. Cek inbox-mu.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Berhasil login!");
    window.location.href = to;
    void remember;
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account", access_type: "offline" },
    });
    if (res.error) {
      setGoogleLoading(false);
      toast.error(res.error.message ?? "Gagal login dengan Google");
      return;
    }
    if (res.redirected) return; // browser navigates away
    // Token-based path: session set, navigate
    window.location.href = to;
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8 shadow-warm">
        <h1 className="font-display text-3xl font-semibold text-center">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">Lanjutkan baca cerita favoritmu.</p>

        <button
          type="button"
          onClick={onGoogle}
          disabled={googleLoading}
          className="mt-6 w-full py-3 rounded-xl bg-card border border-border hover:bg-accent/40 transition flex items-center justify-center gap-3 font-medium disabled:opacity-60"
        >
          <GoogleIcon /> {googleLoading ? "Menghubungkan..." : "Lanjut dengan Google"}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> atau email <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={show ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-primary hover:underline">Lupa password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow hover:shadow-warm disabled:opacity-60 transition-all"
          >
            {loading ? "Loading..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.91c1.71-1.57 2.69-3.89 2.69-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 009 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

void redirect;
