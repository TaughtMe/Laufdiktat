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

export const getNeedRefresh = () => needRefresh;

export const subscribeNeedRefresh = (l: Listener) => {
  listeners.add(l);
  l(needRefresh);
  return () => {
    listeners.delete(l);
  };
};
