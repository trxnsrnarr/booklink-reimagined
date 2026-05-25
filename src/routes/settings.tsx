import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Sun, Moon, Languages, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/hooks/use-i18n";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl font-semibold flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" /> {t("settings.title")}
        </h1>
      </motion.div>

      <section className="mt-8 glass-strong rounded-2xl p-6">
        <h2 className="font-semibold text-lg">{t("settings.appearance")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.appearanceDesc")}</p>

        <div className="mt-5">
          <p className="text-sm font-medium mb-2">Theme</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: "light" as const, label: t("common.theme.light"), icon: Sun },
              { id: "dark" as const, label: t("common.theme.dark"), icon: Moon },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={`rounded-2xl p-4 border text-left transition-all ${theme === opt.id ? "border-primary bg-primary/10 shadow-glow" : "border-border glass hover:bg-accent/30"}`}
              >
                <opt.icon className={`h-5 w-5 ${theme === opt.id ? "text-primary" : "text-muted-foreground"}`} />
                <p className="mt-2 font-medium">{opt.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium mb-2 flex items-center gap-2"><Languages className="h-4 w-4" /> {t("common.lang")}</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: "id" as Lang, label: "🇮🇩 Bahasa Indonesia" },
              { id: "en" as Lang, label: "🇬🇧 English" },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setLang(opt.id)}
                className={`rounded-2xl p-4 border text-left transition-all ${lang === opt.id ? "border-primary bg-primary/10 shadow-glow" : "border-border glass hover:bg-accent/30"}`}
              >
                <p className="font-medium">{opt.label}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {user && (
        <section className="mt-6 glass-strong rounded-2xl p-6">
          <h2 className="font-semibold text-lg">{t("settings.account")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("settings.signedAs")} <span className="text-foreground font-medium">{user.email}</span></p>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" /> {t("nav.logout")}
          </button>
        </section>
      )}

      {!user && (
        <div className="mt-6 glass rounded-2xl p-6 text-center">
          <Link to="/login" className="inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium">{t("nav.login")}</Link>
        </div>
      )}
    </div>
  );
}
