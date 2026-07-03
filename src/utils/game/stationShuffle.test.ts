import { describe, it, expect } from 'vitest';
import { buildStationOrder } from './stationShuffle';

describe('buildStationOrder', () => {
  const words = ['a', 'b', 'c', 'd', 'e'];

  it('liefert für dieselbe Schülernummer und Sitzung immer dieselbe Reihenfolge (geräteunabhängig)', () => {
    const orderA = buildStationOrder(words, '1234', 'session-1', 2);
    const orderB = buildStationOrder(words, '1234', 'session-1', 2);
    expect(orderB).toEqual(orderA);
  });

  it('liefert für verschiedene Schülernummern unterschiedliche Reihenfolgen', () => {
    const order1 = buildStationOrder(words, '1234', 'session-1', 1);
    const order2 = buildStationOrder(words, '1234', 'session-1', 2);
    expect(order2).not.toEqual(order1);
  });

  it('mutiert das Originalarray nicht', () => {
    const original = [...words];
    buildStationOrder(words, '1234', 'session-1', 3);
    expect(words).toEqual(original);
  });

  it('liefert eine reine Permutation (gleiche Elemente, gleiche Länge)', () => {
    const order = buildStationOrder(words, '1234', 'session-1', 5);
    expect(order).toHaveLength(words.length);
    expect([...order].sort()).toEqual([...words].sort());
  });
});
