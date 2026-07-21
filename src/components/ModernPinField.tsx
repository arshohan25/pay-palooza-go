import { useRef } from "react";

interface ModernPinFieldProps {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  slotClassName?: string;
  activeClassName?: string;
}

/**
 * A single modern PIN input rendered as 4 (or N) segmented slots.
 * The slots ARE the field — a transparent input overlays them and
 * captures keystrokes, so there is no separate visible input.
 */
export default function ModernPinField({
  value,
  onChange,
  length = 4,
  autoFocus = true,
  slotClassName = "w-12 h-12 rounded-xl border-2 border-border bg-card text-muted-foreground",
  activeClassName = "border-primary bg-primary/10 text-primary",
}: ModernPinFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const slots = Array.from({ length });

  return (
    <div
      className="relative inline-flex gap-3 cursor-text"
      onClick={() => ref.current?.focus()}
    >
      {slots.map((_, i) => {
        const filled = value.length > i;
        const active = value.length === i;
        return (
          <div
            key={i}
            className={`flex items-center justify-center text-xl font-bold transition-all ${slotClassName} ${
              filled ? activeClassName : active ? "ring-2 ring-primary/40" : ""
            }`}
          >
            {filled ? "•" : ""}
          </div>
        );
      })}
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, length))
        }
        aria-label="PIN"
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
      />
    </div>
  );
}
