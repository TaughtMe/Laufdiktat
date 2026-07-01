import { registerSW } from 'virtual:pwa-register';

/** Aktuelle App-Version (mit dem Mathe-Teil: 2.0.0). */
export const APP_VERSION = '2.0.0';

type Listener = (needRefresh: boolean) => void;
const listeners = new Set<Listener>();
let needRefresh = false;

const emit = () => {
  for (const l of listeners) l(needRefresh);
};

// Registriert den Service Worker. onNeedRefresh feuert, sobald ein neuer Build
// bereitsteht – wir wenden ihn NICHT automatisch an, sondern melden es nur.
const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh = true;
    emit();
  },
});

/** Neuen Build anwenden (Service Worker übernimmt) und Seite neu laden. */
export const applyUpdate = () => updateSW(true);

/** Aktiv nach einem Update suchen (z. B. beim Klick auf den Versions-Button). */
export const checkForUpdate = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update();
};

/**
 * Wie checkForUpdate, wartet aber zusätzlich bis zu timeoutMs darauf, dass ein
 * gefundenes Update tatsächlich fertig installiert ist (needRefresh wird erst
 * asynchron true, NACHDEM reg.update() zurückkehrt – reines Prüfen auf
 * reg.update() sagt nur "Suche gestartet", nicht "Update ist bereit").
 * Gibt true zurück, sobald applyUpdate() sicher etwas zum Anwenden hat.
 */
export const checkForUpdateReady = async (timeoutMs = 2000): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update();

  if (getNeedRefresh()) return true;

  return new Promise<boolean>((resolve) => {
    let unsubscribe = () => {};
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(getNeedRefresh());
    }, timeoutMs);
    unsubscribe = subscribeNeedRefresh((need) => {
      if (!need) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(true);
    });
  });
};

export const getNeedRefresh = () => needRefresh;

export { compareVersions } from './utils/shared/compareVersions';

export const subscribeNeedRefresh = (l: Listener) => {
  listeners.add(l);
  l(needRefresh);
  return () => {
    listeners.delete(l);
  };
};
