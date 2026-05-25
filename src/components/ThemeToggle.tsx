import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { useI18n } from "@/hooks/use-i18n";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t("common.theme.light") : t("common.theme.dark")}
      title={isDark ? t("common.theme.light") : t("common.theme.dark")}
      className="relative h-9 w-9 rounded-full glass hover:bg-accent/50 flex items-center justify-center overflow-hidden transition-colors"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Moon className="h-4 w-4 text-primary-glow" />
          </motion.span>
        ) : (
          <motion.span key="sun" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Sun className="h-4 w-4 text-primary" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
