import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function GameCenter() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Link
      to="/mini-games"
      aria-label="Buka Mini Games"
      className="fixed bottom-5 right-5 z-[70] block pointer-events-auto sm:bottom-7 sm:right-7"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        className="relative grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl"
        style={{
          background: "linear-gradient(135deg, oklch(0.45 0.13 45), oklch(0.62 0.13 50) 55%, oklch(0.78 0.13 80))",
          boxShadow: "0 12px 32px -8px oklch(0.45 0.13 45 / 0.55), 0 0 0 1px oklch(0.78 0.13 80 / 0.4) inset",
        }}
      >
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full" style={{ background: "oklch(0.78 0.13 80 / 0.35)" }} />
        <Gamepad2 className="relative h-6 w-6" />
      </motion.div>
    </Link>
  );
}
