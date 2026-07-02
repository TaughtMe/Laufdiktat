/**
 * Ersetzt das Lehrer-Dashboard auf schmalen Bildschirmen (siehe useIsSmallScreen).
 * Das Dashboard ist auf Tablet/Laptop ausgelegt; statt es kaputt zu quetschen,
 * gibt es hier einen klaren Hinweis mit der Möglichkeit, trotzdem fortzufahren.
 */
export const DashboardMobileWarning = ({ onContinueAnyway }: { onContinueAnyway: () => void }) => (
  <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-page text-center">
    <div className="bg-surface rounded-[22px] border border-line shadow-sm p-8 max-w-sm w-full">
      <span className="text-5xl mb-4 block">🖥️</span>
      <h2 className="text-lg font-extrabold text-ink mb-2">
        Bildschirm zu schmal
      </h2>
      <p className="text-sm text-ink-muted mb-6 leading-relaxed">
        Für das Lehrer-Dashboard bitte Tablet, Laptop oder Querformat nutzen.
      </p>
      <button
        type="button"
        onClick={onContinueAnyway}
        className="w-full py-3 rounded-xl font-bold text-sm bg-accent hover:opacity-90 text-white transition-all active:scale-[0.98] cursor-pointer"
      >
        Trotzdem öffnen
      </button>
    </div>
  </div>
);
