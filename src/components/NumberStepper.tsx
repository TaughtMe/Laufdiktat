import { Minus, Plus } from 'lucide-react';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * Zahlenfeld mit −/+-Buttons links und rechts statt der nativen
 * (optisch unschönen) Spinner-Pfeile.
 */
export const NumberStepper = ({ value, onChange, min = 1, max = 999 }: NumberStepperProps) => {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const btn =
    'w-10 h-10 flex items-center justify-center text-darkteal-800 dark:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800 enabled:active:scale-95 cursor-pointer';

  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden select-none">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} className={btn} aria-label="Weniger">
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="w-12 text-center font-bold py-2 bg-transparent border-x border-slate-200 dark:border-slate-800 focus:outline-none dark:text-white"
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} className={btn} aria-label="Mehr">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
