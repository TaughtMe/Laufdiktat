import { useEffect, useState } from 'react';
import { APP_VERSION, applyUpdate, checkForUpdate, getNeedRefresh, subscribeNeedRefresh } from '../../pwa';

/**
 * Kleiner Versions-Button.
 * - Zeigt die App-Version (z. B. v2.0.0).
 * - Klick sucht nach einem Update; ist eins verfügbar, leuchtet er rot.
 * - Erneuter Klick (oder Klick bei rot) wendet das Update an (optional).
 *
 * Standardmäßig unten rechts fixiert (Home). Mit `fixed={false}` ohne eigene
 * Position, zum Einbetten in ein Layout (z. B. mittig im Dashboard-Footer).
 */
export const VersionBadge = ({ className = '', fixed = true }: { className?: string; fixed?: boolean }) => {
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
      className={`${fixed ? 'fixed bottom-2 right-2 z-[60]' : ''} text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
        needRefresh
          ? 'bg-danger text-white border-danger shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse'
          : 'bg-surface-2 text-ink-faint border-line hover:text-ink-muted'
      } ${className}`}
    >
      {needRefresh ? `🔴 ${label}` : label}
    </button>
  );
};
