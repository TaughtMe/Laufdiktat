// Bündelt alle Zugriffe auf das persistierte Raum-Schema (Phasen 1+3 des
// Architektur-Umbaus, siehe supabase/migrations/20260706120000_rooms_and_progress.sql
// und 20260706130000_progress_and_cleanup.sql). Einzige Stelle im Frontend,
// die die RPC-Funktionsnamen/-Formen kennt.
//
// Sicherheitsmodell (siehe Migrations-Kommentare):
// - access_token ist reines Lehrer-Schreibrecht (open_room/update_session/
//   end_room/getRoomStudents) und verlässt das Dashboard nie.
// - findActiveRoom()/getRoomState()/upsertProgress()/getMyProgress() brauchen
//   nur eine room_id -- derselbe Vertrauensgrad wie die bisherigen
//   Broadcasts (jeder im Raum-Channel konnte immer schon für einen
//   beliebigen Namen Fortschritt "senden").

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

export interface StudentProgress {
  currentIndex: number;
  peeks: number;
  attempts: number;
  errors: number;
  finished: boolean;
}

export interface UpsertProgressInput extends StudentProgress {
  roomId: string;
  sessionId: string;
  studentKey: string;
  durationMs?: number;
  wordErrors?: Record<string, number>;
  appVersion?: string;
  /** Nur im Stationsmodus gesetzt. */
  stationNumber?: number;
}

/**
 * Schreibt/aktualisiert den Fortschritt genau eines Schülers – vereinheitlicht
 * für Direkt- und Stationsmodus (siehe upsert_progress() in der Migration).
 * Idempotent: ein wiederholter Aufruf mit demselben Stand (z. B. nach einem
 * Reconnect) verändert nichts zusätzlich.
 */
export const upsertProgress = async (input: UpsertProgressInput): Promise<void> => {
  const { error } = await supabase.rpc('upsert_progress', {
    p_room_id: input.roomId,
    p_session_id: input.sessionId,
    p_student_key: input.studentKey,
    p_current_index: input.currentIndex,
    p_peeks: input.peeks,
    p_attempts: input.attempts,
    p_errors: input.errors,
    p_finished: input.finished,
    p_duration_ms: input.durationMs ?? null,
    p_word_errors: input.wordErrors ?? {},
    p_app_version: input.appVersion ?? null,
    p_station_number: input.stationNumber ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
};

/** Liest den eigenen Fortschritt zurück (Resync nach Reload/Gerätewechsel). `null`, wenn noch nichts gespeichert wurde. */
export const getMyProgress = async (
  roomId: string,
  sessionId: string,
  studentKey: string
): Promise<StudentProgress | null> => {
  const { data, error } = await supabase.rpc('get_my_progress', {
    p_room_id: roomId,
    p_session_id: sessionId,
    p_student_key: studentKey,
  });
  if (error) {
    throw new Error(error.message);
  }
  const row = data?.[0];
  if (!row) return null;
  return {
    currentIndex: row.current_index,
    peeks: row.peeks,
    attempts: row.attempts,
    errors: row.errors,
    finished: row.finished,
  };
};

export interface RoomStudentRow extends StudentProgress {
  roomId: string;
  sessionId: string;
  studentKey: string;
  stationNumber: number | null;
  durationMs: number | null;
  wordErrors: Record<string, number>;
  appVersion: string | null;
}

/** Liest den Fortschritt ALLER Schüler eines Raums (Lehrer-Dashboard, tokengebunden – Rehydrierung nach einem Reload). */
export const getRoomStudents = async (roomId: string, accessToken: string): Promise<RoomStudentRow[]> => {
  const { data, error } = await supabase.rpc('get_room_students', {
    p_room_id: roomId,
    p_access_token: accessToken,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    roomId: row.room_id as string,
    sessionId: row.session_id as string,
    studentKey: row.student_key as string,
    stationNumber: row.station_number as number | null,
    currentIndex: row.current_index as number,
    peeks: row.peeks as number,
    attempts: row.attempts as number,
    errors: row.errors as number,
    finished: row.finished as boolean,
    durationMs: row.duration_ms as number | null,
    wordErrors: (row.word_errors as Record<string, number>) ?? {},
    appVersion: row.app_version as string | null,
  }));
};
