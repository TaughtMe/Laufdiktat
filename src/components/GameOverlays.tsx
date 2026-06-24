import { useEffect, useState } from 'react';
import { LegalLink } from './LegalLink';

/**
 * Bestätigung beim Verlassen des Spiels. Der "Verlassen"-Button ist die ersten
 * Sekunden gesperrt (Countdown), damit Schüler nicht versehentlich/zu leicht
 * das Spiel verlassen.
 */
export const ExitConfirm = ({
  onConfirm,
  onCancel,
  seconds = 3,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  seconds?: number;
}) => {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const ready = remaining <= 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <span className="text-4xl block mb-3">🚪</span>
        <h3 className="text-white font-bold text-lg mb-1.5">Wirklich verlassen?</h3>
        <p className="text-slate-400 text-sm mb-5">
          Dein Fortschritt geht dabei verloren.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={onConfirm}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-red-500 enabled:hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed enabled:active:scale-[0.98] cursor-pointer"
          >
            {ready ? 'Verlassen' : `Verlassen (${remaining})`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 rounded-xl font-bold text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Weiterspielen
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Vollbild-Hinweis, wenn die Lehrkraft die Sitzung beendet hat – mit
 * Zurück-Button zur Startseite (statt stiller Weiterleitung).
 */
export const SessionEndedOverlay = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-gradient-to-b from-[#0a2a3c] via-[#0d3349] to-[#0a2a3c] flex items-center justify-center p-6">
    <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white/10 text-center max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
      <span className="text-6xl mb-4 block">🏁</span>
      <h2 className="text-2xl font-bold text-white mb-2">Sitzung beendet</h2>
      <p className="text-slate-400 mb-6">
        Die Lehrkraft hat die Sitzung beendet. Danke fürs Mitmachen!
      </p>
      <button
        type="button"
        onClick={onBack}
        className="w-full px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer text-sm"
      >
        Zur Startseite
      </button>
    </div>
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
      <LegalLink dark />
    </div>
  </div>
);
