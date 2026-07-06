// Bündelt alle Zugriffe auf das persistierte Raum-Schema (Phase 1 des
// Architektur-Umbaus, siehe supabase/migrations/20260706120000_rooms_and_progress.sql).
// Einzige Stelle im Frontend, die die RPC-Funktionsnamen/-Formen kennt.
//
// Sicherheitsmodell (siehe Migrations-Kommentar): access_token ist reines
// Lehrer-Schreibrecht und verlässt open_room()/wird intern gehalten – wird
// NIE an Schülergeräte weitergegeben. Schüler bekommen über findActiveRoom()
// nur eine room_id, die für den rein lesenden getRoomState() reicht.

import { supabase } from '../supabaseClient';

export interface OpenRoomResult {
  roomId: string;
  code: string;
  accessToken: string;
}

export interface ActiveRoomLookup {
  roomId: string;
  stationMode: boolean;
  status: 'lobby' | 'live' | 'ended';
}

export interface RoomState {
  status: 'lobby' | 'live' | 'ended';
  sessionId: string | null;
  config: Record<string, unknown>;
}

/** Legt einen neuen Raum an (Kahoot-artige Code-Vergabe, siehe open_room() in der Migration). */
export const openRoom = async (config: Record<string, unknown> = {}): Promise<OpenRoomResult> => {
  const { data, error } = await supabase.rpc('open_room', { p_config: config });
  const row = data?.[0];
  if (error || !row) {
    throw new Error(error?.message ?? 'open_room() lieferte keine Daten zurück');
  }
  return { roomId: row.room_id, code: row.code, accessToken: row.access_token };
};

/** Findet einen beitrittsfähigen Raum über den öffentlichen Code. `null`, wenn keiner existiert. */
export const findActiveRoom = async (code: string): Promise<ActiveRoomLookup | null> => {
  const { data, error } = await supabase.rpc('find_active_room', { p_code: code });
  if (error) {
    throw new Error(error.message);
  }
  const row = data?.[0];
  if (!row) return null;
  return { roomId: row.room_id, stationMode: row.station_mode, status: row.status };
};

/** Liest Status/Konfiguration eines Raums (Schülerseite, kein Token nötig). */
export const getRoomState = async (roomId: string): Promise<RoomState | null> => {
  const { data, error } = await supabase.rpc('get_room_state', { p_room_id: roomId });
  if (error) {
    throw new Error(error.message);
  }
  const row = data?.[0];
  if (!row) return null;
  return { status: row.status, sessionId: row.session_id, config: row.config ?? {} };
};

/** Startet/aktualisiert die Sitzung eines Raums (Lehrer-Dashboard, tokengebunden). */
export const updateSession = async (
  roomId: string,
  accessToken: string,
  sessionId: string,
  config: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase.rpc('update_session', {
    p_room_id: roomId,
    p_access_token: accessToken,
    p_session_id: sessionId,
    p_config: config,
  });
  if (error) {
    throw new Error(error.message);
  }
};

/** Beendet einen Raum und gibt seinen Code sofort wieder frei (Lehrer-Dashboard, tokengebunden). */
export const endRoom = async (roomId: string, accessToken: string): Promise<void> => {
  const { error } = await supabase.rpc('end_room', { p_room_id: roomId, p_access_token: accessToken });
  if (error) {
    throw new Error(error.message);
  }
};
