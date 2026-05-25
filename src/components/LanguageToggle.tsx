import { useState } from "react";
import { Languages, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n, type Lang } from "@/hooks/use-i18n";

const OPTIONS: { code: Lang; label: string; flag: string }[] = [
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.code === lang)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="h-9 px-2.5 rounded-full glass hover:bg-accent/50 flex items-center gap-1.5 text-sm transition-colors"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <Languages className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-48 glass-strong rounded-2xl shadow-warm overflow-hidden z-50"
            >
              {OPTIONS.map((o) => (
                <button
                  key={o.code}
                  onClick={() => { setLang(o.code); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="text-lg leading-none">{o.flag}</span>
                  <span className="flex-1">{o.label}</span>
                  {lang === o.code && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
