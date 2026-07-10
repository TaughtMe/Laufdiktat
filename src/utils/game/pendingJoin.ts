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
const PENDING_TOKEN_KEY = 'pendingJoinParticipantToken';

export interface PendingJoin {
  code: string;
  name: string;
  participantToken?: string;
}

export const savePendingJoin = (code: string, name: string, participantToken?: string): void => {
  try {
    sessionStorage.setItem(PENDING_JOIN_KEY, '1');
    sessionStorage.setItem(PENDING_ROOM_KEY, code);
    sessionStorage.setItem(PENDING_NAME_KEY, name);
    if (participantToken) sessionStorage.setItem(PENDING_TOKEN_KEY, participantToken);
    else sessionStorage.removeItem(PENDING_TOKEN_KEY);
  } catch { /* Privater Modus o.ä. – kein Beinbruch */ }
};

export const readPendingJoin = (): PendingJoin | null => {
  try {
    if (sessionStorage.getItem(PENDING_JOIN_KEY) !== '1') return null;
    const code = sessionStorage.getItem(PENDING_ROOM_KEY);
    const name = sessionStorage.getItem(PENDING_NAME_KEY);
    const participantToken = sessionStorage.getItem(PENDING_TOKEN_KEY) || undefined;
    if (!code || !name) return null;
    return participantToken ? { code, name, participantToken } : { code, name };
  } catch {
    return null;
  }
};

export const clearPendingJoin = (): void => {
  try {
    sessionStorage.removeItem(PENDING_JOIN_KEY);
    sessionStorage.removeItem(PENDING_ROOM_KEY);
    sessionStorage.removeItem(PENDING_NAME_KEY);
    sessionStorage.removeItem(PENDING_TOKEN_KEY);
  } catch { /* ignore */ }
};
