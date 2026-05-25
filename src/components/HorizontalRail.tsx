import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalRail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <div className="relative group">
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
        {children}
      </div>
      {canPrev && (
        <button
          aria-label="Scroll previous"
          onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass-strong shadow-warm items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canNext && (
        <button
          aria-label="Scroll next"
          onClick={() => scrollBy(1)}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass-strong shadow-warm items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return (
    <div className="snap-start shrink-0 w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px]">
      {children}
    </div>
  );
}
