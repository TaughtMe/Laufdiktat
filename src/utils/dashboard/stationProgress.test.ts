import { describe, it, expect } from 'vitest';
import { setStationProgress } from './stationProgress';
import type { StationStudentState } from '../../types/game';

describe('setStationProgress', () => {
  it('speichert den Fortschritt einer Schülernummer, unabhängig vom sendenden Gerät', () => {
    let map = new Map<number, StationStudentState>();
    // Update von "iPad A" für Nummer 2
    map = setStationProgress(map, 2, { currentIndex: 0, peeks: 0 });
    // Update von "iPad B" für dieselbe Nummer 2
    map = setStationProgress(map, 2, { currentIndex: 1, peeks: 0 });
    expect(map.get(2)).toEqual({ currentIndex: 1, peeks: 0 });
  });

  it('führt den Fortschritt verschiedener Schülernummern unabhängig voneinander', () => {
    let map = new Map<number, StationStudentState>();
    map = setStationProgress(map, 1, { currentIndex: 3, peeks: 1 });
    map = setStationProgress(map, 2, { currentIndex: 0, peeks: 0 });
    expect(map.get(1)).toEqual({ currentIndex: 3, peeks: 1 });
    expect(map.get(2)).toEqual({ currentIndex: 0, peeks: 0 });
  });

  it('mutiert die übergebene Map nicht', () => {
    const original = new Map<number, StationStudentState>([[1, { currentIndex: 0, peeks: 0 }]]);
    const next = setStationProgress(original, 1, { currentIndex: 5, peeks: 2 });
    expect(original.get(1)).toEqual({ currentIndex: 0, peeks: 0 });
    expect(next.get(1)).toEqual({ currentIndex: 5, peeks: 2 });
    expect(next).not.toBe(original);
  });
});
