import { describe, it, expect } from 'vitest';
import { buildCsvContent } from './exportUtils';

describe('buildCsvContent (Stationen-Format, ohne Details)', () => {
  it('nutzt die einfachen Header ohne Fehler/Versuche', () => {
    const csv = buildCsvContent([
      { name: 'Igel', reachedStation: 3, progressPercent: 75 },
    ]);
    const rows = csv.slice(1).split('\n');
    expect(rows[0]).toBe('Name;Erreichte_Station;Fortschritt_Prozent');
    expect(rows[1]).toBe('Igel;3;75%');
  });
});

describe('buildCsvContent (Detail-Format)', () => {
  it('nutzt die Detail-Header, sobald ein Schüler attempts/errors hat', () => {
    const csv = buildCsvContent([
      { name: 'Igel', reachedStation: 'fertig', progressPercent: 100, errors: 2, attempts: 5, peeks: 1, stars: 3 },
    ]);
    const rows = csv.slice(1).split('\n');
    expect(rows[0]).toBe('Name;Status;Fortschritt_Prozent;Fehler;Versuche;Spicker;Sterne');
    expect(rows[1]).toBe('Igel;fertig;100%;2;5;1;3');
  });

  it('lässt fehlende optionale Werte leer', () => {
    const csv = buildCsvContent([
      { name: 'Igel', reachedStation: 'fertig', progressPercent: 100, attempts: 5 },
    ]);
    const rows = csv.split('\n');
    expect(rows[1]).toBe('Igel;fertig;100%;;5;;');
  });
});

describe('buildCsvContent (Escaping)', () => {
  it('setzt Werte mit Semikolon in Anführungszeichen', () => {
    const csv = buildCsvContent([
      { name: 'Wort;mit Semikolon', reachedStation: 1, progressPercent: 50 },
    ]);
    expect(csv.split('\n')[1]).toBe('"Wort;mit Semikolon";1;50%');
  });

  it('verdoppelt Anführungszeichen im Wert', () => {
    const csv = buildCsvContent([
      { name: 'Sag "Hallo"', reachedStation: 1, progressPercent: 50 },
    ]);
    expect(csv.split('\n')[1]).toBe('"Sag ""Hallo""";1;50%');
  });
});

describe('buildCsvContent (Fehler-Ranking)', () => {
  it('hängt das Ranking mit Leerzeile davor an', () => {
    const csv = buildCsvContent(
      [{ name: 'Igel', reachedStation: 1, progressPercent: 50 }],
      [['Haus', 4], ['Baum', 2]]
    );
    const rows = csv.split('\n');
    expect(rows.slice(2)).toEqual([
      '',
      'Häufigste Fehler;Anzahl',
      'Haus;4',
      'Baum;2',
    ]);
  });

  it('lässt das Ranking bei leerem Array weg', () => {
    const csv = buildCsvContent(
      [{ name: 'Igel', reachedStation: 1, progressPercent: 50 }],
      []
    );
    expect(csv.split('\n')).toHaveLength(2);
  });
});

describe('buildCsvContent (BOM)', () => {
  it('beginnt mit einem UTF-8-BOM', () => {
    const csv = buildCsvContent([{ name: 'Igel', reachedStation: 1, progressPercent: 50 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
