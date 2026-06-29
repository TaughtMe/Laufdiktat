import { useEffect, useState } from 'react';
import { APP_VERSION, applyUpdate, checkForUpdate, getNeedRefresh, subscribeNeedRefresh } from '../pwa';

/**
 * Kleiner Versions-Button unten rechts.
 * - Zeigt die App-Version (z. B. v2.0.0).
 * - Klick sucht nach einem Update; ist eins verfügbar, leuchtet er rot.
 * - Erneuter Klick (oder Klick bei rot) wendet das Update an (optional).
 */
export const VersionBadge = ({ className = '' }: { className?: string }) => {
  const [needRefresh, setNeedRefresh] = useState(getNeedRefresh());
  const [checking, setChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  useEffect(() => subscribeNeedRefresh(setNeedRefresh), []);

  const handleClick = async () => {
    if (needRefresh) {
      applyUpdate(); // wendet den neuen Build an + lädt neu
      return;
    }
    setChecking(true);
    setJustChecked(false);
    await checkForUpdate();
    setChecking(false);
    // Wenn nach der Prüfung kein Update kam, kurz "aktuell" zeigen.
    if (!getNeedRefresh()) {
      setJustChecked(true);
      setTimeout(() => setJustChecked(false), 2000);
    }
  };

  const label = needRefresh
    ? 'Update verfügbar'
    : checking
      ? 'Suche…'
      : justChecked
        ? 'Aktuell ✓'
        : `v${APP_VERSION}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={needRefresh ? 'Update verfügbar – klicken zum Aktualisieren' : 'Version – klicken, um nach Updates zu suchen'}
      className={`fixed bottom-2 right-2 z-[60] text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
        needRefresh
          ? 'bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse'
          : 'bg-white/70 dark:bg-slate-900/70 text-slate-400 dark:text-slate-500 border-slate-200/70 dark:border-slate-700/70 hover:text-slate-600 dark:hover:text-slate-300'
      } ${className}`}
    >
      {needRefresh ? `🔴 ${label}` : label}
    </button>
  );
};
