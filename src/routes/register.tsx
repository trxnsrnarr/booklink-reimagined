import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User as UserIcon, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);
  const scoreLabel = ["Sangat lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"][score] ?? "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      toast.error("Username 3-20 karakter, hanya huruf, angka, underscore.");
      return;
    }
    if (score < 2) {
      toast.error("Password terlalu lemah.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Email verifikasi sudah dikirim!");
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-3xl p-10 text-center shadow-warm">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary/30 to-primary-glow/30 flex items-center justify-center animate-pulse-glow">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold">Cek email kamu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kami sudah mengirim link verifikasi ke <span className="font-medium text-foreground">{email}</span>.
            Klik link tersebut untuk mengaktifkan akun.
          </p>
          <Link to="/login" className="mt-6 inline-block text-primary hover:underline text-sm">
            Kembali ke login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8 shadow-warm">
        <h1 className="font-display text-3xl font-semibold text-center">Bergabung dengan BookLink</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">Dapatkan bonus 100 coin saat daftar.</p>

        <button
          type="button"
          onClick={async () => {
            const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin, extraParams: { prompt: "select_account", access_type: "offline" } });
            if (res.error) toast.error(res.error.message ?? "Gagal Google sign up");
            else if (!res.redirected) window.location.href = "/";
          }}
          className="mt-6 w-full py-3 rounded-xl bg-card border border-border hover:bg-accent/40 transition flex items-center justify-center gap-3 font-medium"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.91c1.71-1.57 2.69-3.89 2.69-6.61z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 009 18z"/>
            <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Daftar dengan Google
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> atau email <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 karakter)"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < score
                          ? score >= 3 ? "bg-primary" : score === 2 ? "bg-gold" : "bg-destructive"
                          : "bg-border"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{scoreLabel}</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-glow hover:shadow-warm disabled:opacity-60 transition-all"
          >
            {loading ? "Mendaftar..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
