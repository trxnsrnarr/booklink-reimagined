import { Check } from "lucide-react";
import { PAYMENT_METHODS, type PaymentMethodKey } from "./payment-methods";
import { cn } from "@/lib/utils";

interface Props {
  value: PaymentMethodKey;
  onChange: (v: PaymentMethodKey) => void;
}

export function PaymentMethodPicker({ value, onChange }: Props) {
  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      {PAYMENT_METHODS.map((m) => {
        const active = m.key === value;
        const Icon = m.Icon;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={cn(
              "relative text-left rounded-2xl p-4 border transition-all flex items-center gap-3 group",
              active
                ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-glow"
                : "border-border glass hover:border-primary/40 hover:bg-accent/30"
            )}
          >
            <div className={cn(
              "h-11 w-11 rounded-xl grid place-items-center shrink-0 transition-colors",
              active ? "bg-primary/20 text-primary" : "bg-muted text-foreground/70 group-hover:bg-primary/10"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm">{m.label}</p>
                {m.badge && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{m.badge}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{m.description}</p>
            </div>
            {active && (
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
                <Check className="h-3.5 w-3.5" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}