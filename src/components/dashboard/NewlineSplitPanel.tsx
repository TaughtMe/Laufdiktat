import type { NewlineMode, TextSplitConfig } from '../../utils/dashboard/textSections';

const OPTIONS: Array<{ id: NewlineMode; label: string }> = [
  { id: 'line', label: 'jeder neuen Zeile' },
  { id: 'paragraph', label: 'nur Leerzeilen' },
];

interface NewlineSplitPanelProps {
  config: TextSplitConfig;
  onChange: (config: TextSplitConfig) => void;
}

/**
 * Dauerhaft sichtbares Panel der Regel „Enter". Das komplette Abschalten läuft
 * über den Regelschalter darüber, deshalb gibt es hier bewusst KEINE dritte
 * Option „ignorieren".
 */
export const NewlineSplitPanel = ({ config, onChange }: NewlineSplitPanelProps) => (
  <div className="flex flex-col gap-2.5">
    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-muted">
      Trennen bei
    </span>

    <div role="radiogroup" aria-label="Trennen bei" className="flex flex-col gap-1">
      {OPTIONS.map((opt) => {
        const active = config.newlineMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange({ ...config, newlineMode: opt.id })}
            className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-[9px] px-2 text-left
              transition-colors hover:bg-surface"
          >
            <span
              className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                active ? 'border-accent' : 'border-line'
              }`}
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </span>
            <span className="text-[12.5px] font-bold text-ink">{opt.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
