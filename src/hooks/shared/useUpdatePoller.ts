import { useEffect } from 'react';
import { checkForUpdateReady, applyUpdate } from '../../pwa';

interface UseUpdatePollerOptions {
  /** Polling ganz aus-/einschalten (z. B. nur während GameState IDLE). */
  enabled?: boolean;
  /** Abstand zwischen den Prüfungen. */
  intervalMs?: number;
  /** Gefundenes Update sofort anwenden (Reload) statt nur needRefresh zu setzen. */
  autoApply?: boolean;
}

/**
 * Prüft in der laufenden App regelmäßig auf ein neues Update, statt sich auf
 * den (vom Browser schlafen gelegten) Service-Worker-eigenen Update-Zyklus zu
 * verlassen. Prüft zusätzlich sofort beim Zurückkehren in den Tab.
 * autoApply steuert, ob ein gefundenes Update automatisch angewendet wird
 * (nur dort sinnvoll, wo dabei kein Fortschritt verloren geht, z. B. Home) –
 * sonst wird nur needRefresh gesetzt (VersionBadge leuchtet, Nutzer entscheidet).
 */
export const useUpdatePoller = ({
  enabled = true,
  intervalMs = 5 * 60 * 1000,
  autoApply = false,
}: UseUpdatePollerOptions = {}) => {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const check = async () => {
      const ready = await checkForUpdateReady();
      if (cancelled) return;
      if (ready && autoApply) {
        applyUpdate();
      }
    };

    check(); // einmal sofort

    const interval = window.setInterval(check, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, autoApply]);
};
