// Merkt den zufällig gewürfelten Tiernamen zusammen mit dem Raum-Code, in
// dem er zuletzt benutzt wurde (localStorage – muss auch einen kompletten
// Neustart der App überleben, z. B. Tablet-Akku leer, App force-quit).
// Ohne das bekäme ein Schüler bei jedem Neustart einen NEUEN Zufallsnamen
// (Home.tsx: useState(getRandomName)) und könnte seinen serverseitig
// gespeicherten Fortschritt (siehe utils/rooms/roomApi.ts: upsertProgress,
// student_key = Name) nie wiederfinden – der ganze Sinn von Phase 3 (Resync
// nach Reload/Gerätewechsel) würde für den Normalfall "Schüler startet die
// App neu" ins Leere laufen.
//
// Bewusst nur EIN einzelner {roomCode, name}-Eintrag (keine wachsende Liste
// je Raum): ein Schüler spielt zu einem Zeitpunkt ohnehin nur in einem Raum.
// Ein neuer, anderer Raum-Code überschreibt den alten Eintrag und bekommt
// dadurch korrekt wieder einen frischen Zufallsnamen.
const KEY = 'studentIdentity';

interface StudentIdentity {
  roomCode: string;
  name: string;
}

export const saveStudentIdentity = (roomCode: string, name: string): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ roomCode, name }));
  } catch { /* Privater Modus o.ä. – kein Beinbruch */ }
};

/** Liefert den gemerkten Namen nur, wenn er zu genau diesem Raum-Code gehört. */
export const getStudentNameForRoom = (roomCode: string): string | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudentIdentity>;
    if (parsed.roomCode === roomCode && typeof parsed.name === 'string') {
      return parsed.name;
    }
    return null;
  } catch {
    return null;
  }
};

export const clearStudentIdentity = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
};
