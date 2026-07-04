import type { StationStudentState } from '../../types/game';

/**
 * Schreibt den Fortschritt einer Schülernummer in die Stations-Zustands-Map.
 * Bewusst rein nach Schülernummer geschlüsselt (kein Geräte-Bezug): egal von
 * welchem Stations-iPad das Update kommt, es landet unter derselben Nummer.
 */
export const setStationProgress = (
  prev: Map<number, StationStudentState>,
  studentNumber: number,
  state: StationStudentState,
): Map<number, StationStudentState> => {
  const next = new Map(prev);
  next.set(studentNumber, state);
  return next;
};
