// Merkt den Fortschritt (aktueller Wortindex) eines Schülers in einer laufenden
// Sitzung über einen Reload/Reconnect hinweg (localStorage – muss auch einen
// vom Betriebssystem beendeten und neu gestarteten Tab/App-Prozess überleben,
// z. B. auf Schul-iPads mit wenig Arbeitsspeicher). Ohne das würde jeder
// Reload/Resync den Schüler wieder auf Wort 1 zurückwerfen, siehe Game.tsx:
// onSessionStart.
const PROGRESS_KEY = 'sessionProgress';

interface StoredProgress {
  roomCode: string;
  studentName: string;
  sessionId: string;
  index: number;
}

export const saveSessionProgress = (
  roomCode: string,
  studentName: string,
  sessionId: string,
  index: number
): void => {
  try {
    const entry: StoredProgress = { roomCode, studentName, sessionId, index };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(entry));
  } catch { /* Privater Modus o.ä. – kein Beinbruch */ }
};

/** Liefert den gespeicherten Wortindex nur, wenn er zu genau dieser Sitzung gehört. */
export const readSessionProgress = (
  roomCode: string,
  studentName: string,
  sessionId: string
): number | null => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<StoredProgress>;
    if (
      entry.roomCode === roomCode &&
      entry.studentName === studentName &&
      entry.sessionId === sessionId &&
      typeof entry.index === 'number'
    ) {
      return entry.index;
    }
    return null;
  } catch {
    return null;
  }
};

export const clearSessionProgress = (): void => {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch { /* ignore */ }
};
