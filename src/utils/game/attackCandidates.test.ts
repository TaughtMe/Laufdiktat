import { describe, it, expect } from 'vitest';
import { pickAttackCandidates } from './attackCandidates';

describe('pickAttackCandidates', () => {
  it('liefert nichts ohne Mitspieler', () => {
    expect(pickAttackCandidates({}, 'Igel', 5)).toEqual([]);
    expect(pickAttackCandidates({ Igel: 5 }, 'Igel', 5)).toEqual([]);
  });

  it('Verfolger sieht die nächsten vor ihm liegenden (nächste zuerst)', () => {
    const roster = { Fuchs: 8, Hase: 6, Bär: 10, Eule: 3 };
    expect(pickAttackCandidates(roster, 'Igel', 5)).toEqual([
      { name: 'Hase', index: 6 },
      { name: 'Fuchs', index: 8 },
      { name: 'Bär', index: 10 },
    ]);
  });

  it('Verfolger sieht auch gleich weite Mitspieler', () => {
    const roster = { Fuchs: 5, Bär: 10 };
    expect(pickAttackCandidates(roster, 'Igel', 5)).toEqual([
      { name: 'Fuchs', index: 5 },
      { name: 'Bär', index: 10 },
    ]);
  });

  it('Führender sieht die 3 direkt dahinter (nächste zuerst)', () => {
    const roster = { Fuchs: 8, Hase: 6, Eule: 3, Wolf: 1 };
    expect(pickAttackCandidates(roster, 'Igel', 10)).toEqual([
      { name: 'Fuchs', index: 8 },
      { name: 'Hase', index: 6 },
      { name: 'Eule', index: 3 },
    ]);
  });

  it('zwei gleichauf Führende können einander angreifen', () => {
    const roster = { Fuchs: 10, Hase: 6 };
    expect(pickAttackCandidates(roster, 'Igel', 10)).toEqual([
      { name: 'Fuchs', index: 10 },
      { name: 'Hase', index: 6 },
    ]);
  });

  it('begrenzt auf höchstens 3 Ziele', () => {
    const roster = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    expect(pickAttackCandidates(roster, 'Igel', 10)).toHaveLength(3);
    expect(pickAttackCandidates(roster, 'Igel', 0)).toHaveLength(3);
  });
});
