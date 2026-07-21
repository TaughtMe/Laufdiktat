import { useEffect } from 'react';
import { logDevError } from '../../utils/shared/logging';

/**
 * Hält den Bildschirm wach (Screen Wake Lock API), solange `enabled` ist und
 * der Tab sichtbar ist. Verhindert im Klassenzimmer, dass Schülergeräte
 * während der Wartephase (alle loggen sich nacheinander ein) oder mitten im
 * Laufdiktat in den Standby gehen -- ein gesperrter Bildschirm trennt die
 * Realtime-Verbindung, und der Schüler verschwindet aus der Lobby, obwohl
 * sein Gerät "angemeldet" anzeigt (siehe useGameRoom.ts).
 *
 * Auf Browsern ohne Wake-Lock-Unterstützung (ältere iPads vor Safari 16.4)
 * ist der Hook ein stiller No-Op -- dort greift weiterhin der Reconnect-Pfad
 * in useGameRoom.ts als Fallback.
 */
export const useWakeLock = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      // request() wirft, wenn der Tab nicht sichtbar ist -- dann übernimmt
      // der visibilitychange-Listener unten, sobald der Tab zurückkommt.
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch (err) {
        // Z. B. Energiesparmodus des Geräts oder Browser-Policy. Kein harter
        // Fehler: die App funktioniert normal weiter, nur ohne Wachhalten.
        logDevError('[WakeLock] Bildschirm-Wachhalten nicht möglich', err);
      }
    };

    // Der Browser gibt den Lock automatisch frei, sobald der Tab in den
    // Hintergrund geht -- beim Zurückkehren muss er explizit NEU angefordert
    // werden, sonst schläft der Bildschirm ab da wieder ein.
    const onVisibilityChange = () => {
      void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {
        // Bereits vom Browser freigegeben (z. B. Tab-Wechsel) -- unkritisch.
      });
      sentinel = null;
    };
  }, [enabled]);
};
