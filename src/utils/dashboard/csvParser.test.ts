import { describe, it, expect } from 'vitest';
import { parseCSV } from './csvParser';

describe('parseCSV (Zeilen)', () => {
  it('macht aus jeder Zeile ein Wort', () => {
    const words = parseCSV('Haus\nBaum\nSchule', 'lines');
    expect(words.map((w) => w.targetWord)).toEqual(['Haus', 'Baum', 'Schule']);
  });

  it('ignoriert leere Zeilen und nimmt nur den Teil vor dem Semikolon', () => {
    const words = parseCSV('Wort;Hinweis\n\n  \nZweites', 'lines');
    expect(words.map((w) => w.targetWord)).toEqual(['Wort', 'Zweites']);
  });

  it('gibt [] bei leerem Text', () => {
    expect(parseCSV('', 'lines')).toEqual([]);
    expect(parseCSV('   ', 'lines')).toEqual([]);
  });
});

describe('parseCSV (Sätze)', () => {
  it('teilt bei Satzzeichen', () => {
    const words = parseCSV('Satz eins. Satz zwei! Und drei?', 'sentences');
    expect(words.map((w) => w.targetWord)).toEqual(['Satz eins.', 'Satz zwei!', 'Und drei?']);
  });
});
