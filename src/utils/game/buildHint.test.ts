import { describe, it, expect } from 'vitest';
import { buildHint } from './buildHint';

describe('buildHint (Einzelwort)', () => {
  it('zeigt bei fraction 0 nur Unterstriche, getrennt durch Leerzeichen', () => {
    expect(buildHint('Haus', 0)).toBe('_ _ _ _');
  });

  it('zeigt bei fraction 1 alle Buchstaben, getrennt durch Leerzeichen', () => {
    expect(buildHint('Haus', 1)).toBe('H a u s');
  });

  it('deckt bei einem Zwischenwert die passende Anzahl Buchstaben auf', () => {
    const hint = buildHint('Haus', 0.5);
    const letters = hint.split(' ');
    expect(letters).toHaveLength(4);
    const revealed = letters.filter((c) => c !== '_');
    expect(revealed).toHaveLength(2); // ceil(4 * 0.5)
  });

  it('ist deterministisch (gleicher Aufruf liefert gleiches Ergebnis)', () => {
    expect(buildHint('Schmetterling', 0.4)).toBe(buildHint('Schmetterling', 0.4));
  });
});

describe('buildHint (Satz)', () => {
  it('maskiert bei fraction 0 jedes Wort auf gleicher Länge, Leerzeichen bleiben erhalten', () => {
    expect(buildHint('Satz zwei', 0)).toBe('____ ____');
  });

  it('gibt bei fraction 1 den Originalsatz zurück', () => {
    expect(buildHint('Satz zwei drei', 1)).toBe('Satz zwei drei');
  });

  it('deckt bei einem Zwischenwert die passende Anzahl Wörter auf', () => {
    const hint = buildHint('Ein Zwei Drei', 1 / 3);
    const words = hint.split(' ');
    expect(words).toHaveLength(3);
    const revealedCount = words.filter((w) => !/^_+$/.test(w)).length;
    expect(revealedCount).toBe(1); // ceil(3 * 1/3)
  });

  it('behält die Wortlänge bei maskierten Wörtern bei', () => {
    const hint = buildHint('Kurz Wortlaenge', 0);
    expect(hint.split(' ').map((w) => w.length)).toEqual([4, 10]);
  });
});
