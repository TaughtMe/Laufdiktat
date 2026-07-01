// Merkt einen angestoßenen Raum-Beitritt über einen Update-Reload hinweg
// (sessionStorage), damit Home.tsx ihn danach automatisch fortsetzen kann.
// Wird bewusst NICHT beim Navigieren zu /game geräumt, sondern erst wenn der
// Beitritt tatsächlich abgeschlossen ist – siehe Game.tsx: clearPendingJoin()
// bei passender Version in onSessionStart, oder bei bewusstem Verlassen
// zurück zur Startseite. Sonst ginge roomCode/studentName bei einem durch
// einen Versions-Mismatch ausgelösten Reload verloren.
const PENDING_JOIN_KEY = 'pendingJoin';
const PENDING_ROOM_KEY = 'pendingJoinRoomCode';
const PENDING_NAME_KEY = 'pendingJoinStudentName';

export interface PendingJoin {
  code: string;
  name: string;
}

export const savePendingJoin = (code: string, name: string): void => {
  try {
    sessionStorage.setItem(PENDING_JOIN_KEY, '1');
    sessionStorage.setItem(PENDING_ROOM_KEY, code);
    sessionStorage.setItem(PENDING_NAME_KEY, name);
  } catch { /* Privater Modus o.ä. – kein Beinbruch */ }
};

export const readPendingJoin = (): PendingJoin | null => {
  try {
    if (sessionStorage.getItem(PENDING_JOIN_KEY) !== '1') return null;
    const code = sessionStorage.getItem(PENDING_ROOM_KEY);
    const name = sessionStorage.getItem(PENDING_NAME_KEY);
    return code && name ? { code, name } : null;
  } catch {
    return null;
  }
};

export const clearPendingJoin = (): void => {
  try {
    sessionStorage.removeItem(PENDING_JOIN_KEY);
    sessionStorage.removeItem(PENDING_ROOM_KEY);
    sessionStorage.removeItem(PENDING_NAME_KEY);
  } catch { /* ignore */ }
};
