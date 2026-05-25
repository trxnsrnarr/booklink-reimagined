import { useMemo } from "react";
import { BookOpen, Sparkles, Star, Feather, Bookmark } from "lucide-react";

const ICONS = [BookOpen, Sparkles, Star, Feather, Bookmark];

export function FloatingBackground() {
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        Icon: ICONS[i % ICONS.length],
        left: `${(i * 73) % 100}%`,
        top: `${(i * 41) % 100}%`,
        size: 16 + (i % 4) * 8,
        delay: `${(i % 5) * 0.7}s`,
        duration: `${6 + (i % 4) * 2}s`,
        opacity: 0.08 + (i % 3) * 0.04,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {items.map((it, i) => (
        <div
          key={i}
          className="absolute animate-float text-primary"
          style={{
            left: it.left,
            top: it.top,
            opacity: it.opacity,
            animationDelay: it.delay,
            animationDuration: it.duration,
          }}
        >
          <it.Icon style={{ width: it.size, height: it.size }} />
        </div>
      ))}
      {/* particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={`p-${i}`}
          className="absolute h-1 w-1 rounded-full bg-primary-glow animate-pulse-glow"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23) % 100}%`,
            opacity: 0.3,
            animationDelay: `${(i % 6) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}
