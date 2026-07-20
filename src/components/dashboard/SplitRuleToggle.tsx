import { Check } from 'lucide-react';

interface SplitRuleToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

/**
 * Ein Regelschalter („Zeichen" / „Enter"). Reiner An/Aus-Schalter – die
 * zugehörigen Feineinstellungen stehen dauerhaft in der Leiste darunter und
 * werden dort ausgegraut, statt in einem Popover zu verschwinden.
 */
export const SplitRuleToggle = ({ label, active, onToggle }: SplitRuleToggleProps) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={active}
    className={`flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-[10px] border px-4
      text-[13px] font-extrabold transition-colors ${
        active
          ? 'border-accent bg-accent-soft text-accent-strong'
          : 'border-line text-ink-muted hover:text-ink'
      }`}
  >
    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
    <span>{label}</span>
  </button>
);
