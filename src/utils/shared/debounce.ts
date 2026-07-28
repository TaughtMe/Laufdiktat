// Trailing-Debounce MIT Obergrenze (maxWait). Ein reines Trailing-Debounce
// (clearTimeout + setTimeout bei jedem Aufruf) hat einen Aushunger-Fehler:
// Solange Ereignisse dichter als delayMs eintreffen, wird der Timer immer
// wieder zurückgesetzt und die Funktion feuert NIE -- im Klassenzimmer z. B.
// 19 tippende Schüler, deren student-progress-Broadcasts den Ergebnisabgleich
// des Dashboards dauerhaft hinauszögern. maxWait garantiert: Spätestens
// maxWaitMs nach dem ERSTEN aufgestauten Aufruf feuert die Funktion, egal wie
// dicht die Ereignisse kommen.

export interface Debounced {
  /** Plant einen Aufruf; mehrere Aufrufe innerhalb von delayMs werden gebündelt. */
  schedule: () => void;
  /** Verwirft einen noch ausstehenden Aufruf (z. B. beim Unmount). */
  cancel: () => void;
}

export const createDebounced = (
  fn: () => void,
  { delayMs, maxWaitMs }: { delayMs: number; maxWaitMs: number }
): Debounced => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Zeitpunkt des ersten Aufrufs der aktuellen "Welle" -- Anker für maxWait.
  let firstScheduledAt = 0;

  const run = () => {
    timer = null;
    fn();
  };

  return {
    schedule: () => {
      const now = Date.now();
      if (timer === null) {
        firstScheduledAt = now;
      } else {
        clearTimeout(timer);
      }
      const untilMaxWait = firstScheduledAt + maxWaitMs - now;
      timer = setTimeout(run, Math.max(0, Math.min(delayMs, untilMaxWait)));
    },
    cancel: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
};
