interface WizardFooterProps {
  canBack: boolean;
  onBack: () => void;
  nextLabel: string;
  /** Farbcharakter des Primär-Buttons: Standard (accent), Start (ok), Beenden (danger). */
  nextVariant?: 'accent' | 'ok' | 'danger';
  nextDisabled?: boolean;
  onNext: () => void;
}

const VARIANT_CLASS: Record<NonNullable<WizardFooterProps['nextVariant']>, string> = {
  accent: 'bg-accent hover:opacity-90',
  ok: 'bg-ok hover:opacity-90',
  danger: 'bg-danger hover:opacity-90',
};

/**
 * Wizard-Fußzeile nach dem Redesign: links "← Zurück" (auf Schritt 1
 * unsichtbar, behält aber den Platz), rechts der kontextabhängige
 * Primär-Button ("Weiter zur Konfiguration" / "Lobby öffnen" /
 * "Diktat jetzt starten" / "Sitzung beenden").
 */
export const WizardFooter = ({
  canBack,
  onBack,
  nextLabel,
  nextVariant = 'accent',
  nextDisabled = false,
  onNext,
}: WizardFooterProps) => (
  <footer className="px-5 sm:px-9 py-4 border-t border-line bg-surface flex items-center justify-between gap-4 shrink-0">
    <button
      type="button"
      onClick={onBack}
      className={`flex items-center gap-2 text-sm font-bold px-6 py-3.5 rounded-[14px] min-w-[130px] justify-center transition-colors cursor-pointer ${
        canBack
          ? 'text-ink-muted bg-surface-2 hover:text-ink'
          : 'opacity-0 pointer-events-none'
      }`}
      tabIndex={canBack ? 0 : -1}
    >
      ← Zurück
    </button>
    <button
      type="button"
      onClick={onNext}
      disabled={nextDisabled}
      className={`flex items-center gap-2 text-white text-[14.5px] font-extrabold px-7 py-3.5 rounded-[14px] w-full max-w-[260px] whitespace-nowrap justify-center transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${VARIANT_CLASS[nextVariant]}`}
    >
      {nextLabel} →
    </button>
  </footer>
);
