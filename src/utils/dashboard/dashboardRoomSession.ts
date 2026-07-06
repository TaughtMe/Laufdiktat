// Merkt roomId/access_token/roomCode eines geöffneten Raums über einen
// Reload des Lehrer-Dashboard-Tabs hinweg (sessionStorage). Ohne das würde
// ein Reload mitten in einer laufenden Sitzung den kompletten Raum
// "verlieren" -- roomIdRef/accessTokenRef in useDashboardRoom.ts leben nur
// im React-Hook und der komplette Zustand-Store (Wörter etc.) wird bei
// einem Reload ohnehin auf die Ausgangswerte zurückgesetzt.
const KEY = 'dashboardRoomSession';

export interface DashboardRoomSession {
  roomId: string;
  accessToken: string;
  roomCode: string;
}

export const saveDashboardRoomSession = (session: DashboardRoomSession): void => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch { /* Privater Modus o.ä. – kein Beinbruch */ }
};

export const readDashboardRoomSession = (): DashboardRoomSession | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DashboardRoomSession>;
    if (
      typeof parsed.roomId === 'string' &&
      typeof parsed.accessToken === 'string' &&
      typeof parsed.roomCode === 'string'
    ) {
      return { roomId: parsed.roomId, accessToken: parsed.accessToken, roomCode: parsed.roomCode };
    }
    return null;
  } catch {
    return null;
  }
};

export const clearDashboardRoomSession = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
};
