// Merkt einen Raum-Beitritt in sessionStorage -- getrennt in ZWEI Konzepte:
//
// 1. Auto-Join-ABSICHT (Intent-Flag): "Home.tsx soll diesen Beitritt beim
//    nächsten Öffnen automatisch fortsetzen." Nötig für den Update-Reload
//    (Versions-Mismatch -> Update -> Reload -> nahtlos zurück in den Raum)
//    und die Wiederaufnahme nach einem Absturz mitten in der Sitzung.
//    Wird geräumt, sobald der Beitritt sein Ziel erreicht hat (Sitzung
//    übernommen und beendet/fertig, siehe Game.tsx) -- sonst fängt der
//    Auto-Join einen fertigen Schüler, der die Geräte-Zurück-Taste drückt,
//    in einer Schleife zurück ins Spiel.
//
// 2. TOKEN-Zuordnung (roomCode -> Teilnehmertoken + Name): "Dieses Gerät hat
//    für diesen Raum bereits eine Identität." Bleibt unabhängig vom Intent
//    für die ganze Tab-Session erhalten, damit ein erneuter manueller
//    Beitritt (Code nochmal eintippen / QR nochmal scannen) DIESELBE
//    Identität wiederverwendet statt einen Doppel-Teilnehmer anzulegen
//    ("21 Teilnehmer bei 19 Schülern"). Vollständig geräumt wird sie nur,
//    wenn der Raum nachweislich nicht mehr existiert (joinRoom liefert null).
//
// Bewusst sessionStorage, nicht localStorage: Datenminimierung -- nach
// Tab-/Browser-Schluss beginnt das Gerät mit einer frischen Identität.
const PENDING_JOIN_KEY = 'pendingJoin';
const PENDING_ROOM_KEY = 'pendingJoinRoomCode';
const PENDING_NAME_KEY = 'pendingJoinStudentName';
const PENDING_TOKEN_KEY = 'pendingJoinParticipantToken';

export interface PendingJoin {
  code: string;
  name: string;
  participantToken?: string;
}

export interface RoomIdentity {
  name: string;
  participantToken: string;
}

/** Speichert Beitrittswunsch (Intent) UND Identität (Code/Name/Token) zusammen. */
export const savePendingJoin = (code: string, name: string, participantToken?: string): void => {
  try {
    sessionStorage.setItem(PENDING_JOIN_KEY, '1');
    sessionStorage.setItem(PENDING_ROOM_KEY, code);
    sessionStorage.setItem(PENDING_NAME_KEY, name);
    if (participantToken) sessionStorage.setItem(PENDING_TOKEN_KEY, participantToken);
    else sessionStorage.removeItem(PENDING_TOKEN_KEY);
  } catch { /* Privater Modus o.ä. – kein Beinbruch */ }
};

/** Liest den Beitritt NUR, wenn die Auto-Join-Absicht noch gesetzt ist. */
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

/**
 * Liest die gemerkte Identität für GENAU diesen Raumcode -- unabhängig vom
 * Intent-Flag. Quelle für die Token-Wiederverwendung beim manuellen Beitritt.
 */
export const readRoomIdentity = (code: string): RoomIdentity | null => {
  try {
    if (sessionStorage.getItem(PENDING_ROOM_KEY) !== code) return null;
    const name = sessionStorage.getItem(PENDING_NAME_KEY);
    const participantToken = sessionStorage.getItem(PENDING_TOKEN_KEY);
    if (!name || !participantToken) return null;
    return { name, participantToken };
  } catch {
    return null;
  }
};

/**
 * Nimmt nur die Auto-Join-Absicht zurück; die Token-Zuordnung bleibt für
 * einen späteren manuellen Wiederbeitritt erhalten. Für: Sitzung übernommen,
 * Runde fertig, Sitzung beendet, bewusstes Verlassen.
 */
export const clearPendingJoinIntent = (): void => {
  try {
    sessionStorage.removeItem(PENDING_JOIN_KEY);
  } catch { /* ignore */ }
};

/** Räumt ALLES (Intent + Identität). Nur wenn der Raum nicht mehr existiert. */
export const clearPendingJoin = (): void => {
  try {
    sessionStorage.removeItem(PENDING_JOIN_KEY);
    sessionStorage.removeItem(PENDING_ROOM_KEY);
    sessionStorage.removeItem(PENDING_NAME_KEY);
    sessionStorage.removeItem(PENDING_TOKEN_KEY);
  } catch { /* ignore */ }
};
