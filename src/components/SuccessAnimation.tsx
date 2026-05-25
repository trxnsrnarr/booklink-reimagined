import { motion } from "framer-motion";
import { Check } from "lucide-react";

const CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-glow, var(--primary)))",
  "#fbbf24",
  "#f472b6",
  "#34d399",
  "#60a5fa",
];

export function SuccessAnimation({ title, subtitle }: { title: string; subtitle?: string }) {
  const pieces = Array.from({ length: 28 });
  return (
    <div className="relative flex flex-col items-center justify-center py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((_, i) => {
          const x = (Math.random() - 0.5) * 320;
          const y = -120 - Math.random() * 80;
          const rot = (Math.random() - 0.5) * 720;
          const delay = Math.random() * 0.2;
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], x, y, rotate: rot, scale: 1 }}
              transition={{ duration: 1.6, delay, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm"
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>

      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow shadow-glow"
      >
        <motion.div
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
        </motion.div>
        <motion.div
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-primary/30"
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 font-display text-2xl font-semibold text-center"
      >
        {title}
      </motion.h3>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-2 text-sm text-muted-foreground text-center px-4"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
