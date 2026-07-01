/**
 * Ersetzt das Lehrer-Dashboard auf schmalen Bildschirmen (siehe useIsSmallScreen).
 * Das Dashboard ist auf Tablet/Laptop ausgelegt; statt es kaputt zu quetschen,
 * gibt es hier einen klaren Hinweis mit der Möglichkeit, trotzdem fortzufahren.
 */
export const DashboardMobileWarning = ({ onContinueAnyway }: { onContinueAnyway: () => void }) => (
  <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-center">
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm p-8 max-w-sm w-full">
      <span className="text-5xl mb-4 block">🖥️</span>
      <h2 className="text-lg font-bold text-darkteal-800 dark:text-white mb-2">
        Bildschirm zu schmal
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        Für das Lehrer-Dashboard wird ein Tablet, Laptop oder Querformat empfohlen.
      </p>
      <button
        type="button"
        onClick={onContinueAnyway}
        className="w-full py-3 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-600 text-white transition-all active:scale-[0.98] cursor-pointer"
      >
        Trotzdem öffnen
      </button>
    </div>
  </div>
);
