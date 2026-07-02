import { ChevronLeft, Moon, Sun, Check } from 'lucide-react';
import { useTheme } from '../../hooks/shared/useTheme';
import { STEP_ORDER, STEP_META, type DashboardStep } from './stepMeta';

interface DashboardHeaderProps {
  currentStep: DashboardStep;
  /** Schritte 2–4 sind erst wählbar, wenn eine Wortliste existiert. */
  stepsUnlocked: boolean;
  onStepSelect: (step: DashboardStep) => void;
  onBackToHome: () => void;
}

/**
 * Kopfzeile des Dashboards nach dem Redesign: App-Titel + Theme-Toggle oben,
 * darunter Schritt-Label ("Schritt X von 4 · Titel") und der Pill-Stepper
 * (aktiver Schritt als Pill mit Namen, erledigte als Häkchen-Kreis,
 * kommende als nummerierte Kreise, verbunden durch kurze Linien).
 */
export const DashboardHeader = ({ currentStep, stepsUnlocked, onStepSelect, onBackToHome }: DashboardHeaderProps) => {
  const { dark, toggleTheme } = useTheme();
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  const meta = STEP_META[currentStep];

  return (
    <header className="px-5 sm:px-9 pt-3 pb-2.5 bg-surface border-b border-line shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackToHome}
            className="p-1.5 -ml-2 rounded-full text-ink-faint hover:text-ink-muted hover:bg-surface-2 transition-colors cursor-pointer"
            title="Zurück zur Startseite"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="font-extrabold text-[15px] tracking-tight text-ink leading-tight">Laufdiktat</div>
            <span className="text-[11px] text-ink-faint">Lehrer-Dashboard</span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full bg-surface-2 text-ink-muted flex items-center justify-center cursor-pointer hover:text-ink transition-colors"
          title={dark ? 'Helles Design' : 'Dunkles Design'}
          aria-label={dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
        >
          {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 gap-4">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-faint whitespace-nowrap">{meta.label}</span>
          <span className="text-[11px] text-ink-faint">·</span>
          <h2 className="text-[15px] font-extrabold text-ink m-0 tracking-tight truncate">{meta.title}</h2>
        </div>

        <div className="flex items-center shrink-0">
          {STEP_ORDER.map((step, idx) => {
            const isCurrent = idx === currentIdx;
            const isDone = idx < currentIdx;
            const selectable = step === 'IMPORT' || stepsUnlocked;
            const lineReached = idx > 0 && idx <= currentIdx;
            return (
              <div key={step} className="flex items-center">
                {idx > 0 && (
                  <div className={`w-3.5 h-0.5 shrink-0 ${lineReached ? 'bg-accent' : 'bg-line'}`} />
                )}
                {isCurrent ? (
                  <button
                    type="button"
                    onClick={() => onStepSelect(step)}
                    className="flex items-center gap-1.5 py-[3px] pl-[3px] pr-2.5 rounded-full bg-accent text-white shadow-[0_0_0_3px_var(--accent-soft)] cursor-pointer"
                  >
                    <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-extrabold shrink-0">{idx + 1}</span>
                    <span className="text-[11.5px] font-bold whitespace-nowrap">{STEP_META[step].pill}</span>
                  </button>
                ) : isDone ? (
                  <button
                    type="button"
                    onClick={() => onStepSelect(step)}
                    className="w-[22px] h-[22px] rounded-full bg-accent flex items-center justify-center shrink-0 cursor-pointer"
                    title={STEP_META[step].pill}
                  >
                    <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectable && onStepSelect(step)}
                    disabled={!selectable}
                    className="w-[22px] h-[22px] rounded-full bg-surface-2 text-ink-faint flex items-center justify-center text-[10px] font-bold shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    title={STEP_META[step].pill}
                  >
                    {idx + 1}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
};
