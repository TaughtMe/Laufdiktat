import { Minus, Plus } from 'lucide-react';

/** Kleiner −/+-Stepper im Design-Stil (26-px-Quadrate). */
export const MiniStepper = ({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) => (
  <div className="flex items-center gap-2.5 shrink-0">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className="w-[26px] h-[26px] flex items-center justify-center bg-surface border border-line rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-ink"
      aria-label="Weniger"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <span className="text-[13px] font-extrabold min-w-[24px] text-center text-ink">{value}</span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="w-[26px] h-[26px] flex items-center justify-center bg-surface border border-line rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-ink"
      aria-label="Mehr"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);
