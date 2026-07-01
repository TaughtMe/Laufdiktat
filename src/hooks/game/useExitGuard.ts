import { useEffect } from 'react';

/**
 * Fängt die Browser-/Geräte-Zurück-Navigation ab, solange `active` true ist.
 * Statt das Spiel zu verlassen, wird `onAttempt` aufgerufen (z. B. um die
 * Verlassen-Bestätigung zu öffnen). Verhindert versehentliches Verlassen per
 * Zurück-Wischen/Hardware-Button auf Tablets/Handys.
 */
export const useExitGuard = (active: boolean, onAttempt: () => void) => {
  useEffect(() => {
    if (!active) return;
    // Eine "Falle" in den Verlauf legen, die der Zurück-Knopf zuerst trifft.
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      // Erneut eine Falle setzen, damit wir auf der Seite bleiben, und fragen.
      window.history.pushState(null, '', window.location.href);
      onAttempt();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active, onAttempt]);
};
