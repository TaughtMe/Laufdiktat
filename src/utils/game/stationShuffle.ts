import { seededShuffle } from '../shared/seededShuffle';

/**
 * Aufgaben-Reihenfolge einer Schülernummer im Stationsmodus. Der Seed enthält
 * bewusst KEINEN Geräte-Bezug (Stationen sind geteilte iPads) – dieselbe
 * Schülernummer bekommt so an jedem Stations-iPad dieselbe Reihenfolge.
 */
export const buildStationOrder = <T,>(
  words: T[],
  roomCode: string,
  sessionId: string,
  studentNumber: number,
): T[] => seededShuffle(words, `${roomCode}:${sessionId}:${studentNumber}`);
