import { describe, it, expect } from 'vitest';
import {
  buildTextSections,
  DEFAULT_SPLIT_CONFIG,
  type TextSplitConfig,
  type CustomDelimiter,
  type ManualRange,
} from './textSections';

const cfg = (patch: Partial<TextSplitConfig> = {}): TextSplitConfig => ({
  ...DEFAULT_SPLIT_CONFIG,
  ...patch,
});

const delim = (value: string): CustomDelimiter => ({ id: value, value });

/** Kurzform: nur die Abschnittstexte prüfen. */
const texts = (raw: string, config = cfg(), manual: ManualRange[] = []) =>
  buildTextSections(raw, config, manual).map((s) => s.text);

describe('buildTextSections – automatische Aufteilung', () => {
  it('teilt bei Satzzeichen, Zeichen bleibt am Abschnitt', () => {
    expect(texts("Hallo. Wie geht's?")).toEqual(['Hallo.', "Wie geht's?"]);
  });

  it('lässt Semikolon stehen, wenn nicht ausgewählt', () => {
    expect(texts("Hallo; wie geht's?")).toEqual(["Hallo; wie geht's?"]);
  });

  it('trennt bei Semikolon, wenn ausgewählt', () => {
    expect(texts("Hallo; wie geht's?", cfg({ punctuation: ['.', '!', '?', ';'] }))).toEqual([
      'Hallo;',
      "wie geht's?",
    ]);
  });

  it('fasst mehrere Satzzeichen zu einer Grenze zusammen (?!)', () => {
    expect(texts('Was?! Wirklich… Nein!!!', cfg({ punctuation: ['.', '!', '?', '…'] }))).toEqual([
      'Was?!',
      'Wirklich…',
      'Nein!!!',
    ]);
  });

  it('trennt Dezimalzahlen mit Punkt nicht', () => {
    expect(texts('Der Wert ist 3.5.')).toEqual(['Der Wert ist 3.5.']);
  });

  it('trennt Dezimalzahlen mit Komma nicht (wenn Komma aktiv)', () => {
    expect(texts('Der Wert ist 3,5 Meter, ganz genau.', cfg({ punctuation: ['.', '!', '?', ','] }))).toEqual([
      'Der Wert ist 3,5 Meter,',
      'ganz genau.',
    ]);
  });

  it('zieht schließendes Anführungszeichen mit an den vorherigen Abschnitt', () => {
    expect(texts('„Komm sofort!“, ruft die Mutter.')).toEqual([
      '„Komm sofort!“',
      ', ruft die Mutter.',
    ]);
  });

  it('erzeugt einen Abschnitt bei Text ohne Satzzeichen', () => {
    expect(texts('Ein Satz ohne Ende')).toEqual(['Ein Satz ohne Ende']);
  });

  it('gibt bei leerem Text oder nur Whitespace [] zurück', () => {
    expect(buildTextSections('', cfg())).toEqual([]);
    expect(buildTextSections('   \n  \t ', cfg())).toEqual([]);
  });
});

describe('buildTextSections – Zeilen und Absätze', () => {
  it('line: jeder Zeilenumbruch trennt', () => {
    expect(texts('Zeile1\nZeile2\nZeile3')).toEqual(['Zeile1', 'Zeile2', 'Zeile3']);
  });

  it('line: mehrere Zeilenumbrüche erzeugen keine leeren Abschnitte', () => {
    expect(texts('A\n\n\nB')).toEqual(['A', 'B']);
  });

  it('paragraph: nur Leerzeilen trennen, einzelne Umbrüche bleiben Text', () => {
    expect(texts('Abs1\nnochAbs1\n\nAbs2', cfg({ newlineMode: 'paragraph' }))).toEqual([
      'Abs1\nnochAbs1',
      'Abs2',
    ]);
  });

  it('none: Zeilenumbrüche trennen nicht', () => {
    expect(texts('Zeile1\nZeile2', cfg({ newlineMode: 'none' }))).toEqual(['Zeile1\nZeile2']);
  });

  it('vereinheitlicht Windows-Zeilenumbrüche', () => {
    expect(texts('A\r\nB\rC')).toEqual(['A', 'B', 'C']);
  });
});

describe('buildTextSections – benutzerdefinierte Trenner', () => {
  it('trennt bei einer Zeichenfolge und entfernt sie', () => {
    expect(texts('A|||B', cfg({ newlineMode: 'none', customDelimiters: [delim('|||')] }))).toEqual([
      'A',
      'B',
    ]);
  });

  it('erzeugt bei mehreren Trennern hintereinander keine leeren Abschnitte', () => {
    expect(texts('A||||||B', cfg({ newlineMode: 'none', customDelimiters: [delim('|||')] }))).toEqual([
      'A',
      'B',
    ]);
  });

  it('behandelt Wort-Marker als wörtliche Zeichenfolge', () => {
    expect(
      texts('Teil1[ABSCHNITT]Teil2', cfg({ newlineMode: 'none', customDelimiters: [delim('[ABSCHNITT]')] }))
    ).toEqual(['Teil1', 'Teil2']);
  });

  it('nimmt bei Überschneidung den längsten Treffer (Longest Match)', () => {
    expect(
      texts('A|||B', cfg({ newlineMode: 'none', customDelimiters: [delim('|'), delim('|||')] }))
    ).toEqual(['A', 'B']);
  });

  it('ignoriert Trenner am Anfang und Ende', () => {
    expect(
      texts('|||A|||', cfg({ newlineMode: 'none', customDelimiters: [delim('|||')] }))
    ).toEqual(['A']);
  });
});

describe('buildTextSections – kombinierte Regeln', () => {
  it('Satzzeichen und Zeilenumbruch lösen beide eine Grenze aus', () => {
    expect(texts('Der Hund läuft. Die Katze schläft.\nDer Vogel fliegt.')).toEqual([
      'Der Hund läuft.',
      'Die Katze schläft.',
      'Der Vogel fliegt.',
    ]);
  });
});

describe('buildTextSections – manuelle Bereiche', () => {
  const raw = 'Heute gehen wir in den Wald. Dort beobachten wir verschiedene Tiere.';

  it('fasst einen markierten Bereich zu genau einem Abschnitt zusammen', () => {
    const manual: ManualRange[] = [{ id: 'm1', type: 'section', start: 16, end: 33 }];
    const sections = buildTextSections(raw, cfg(), manual);
    expect(sections.map((s) => s.text)).toEqual([
      'Heute gehen wir',
      'in den Wald. Dort',
      'beobachten wir verschiedene Tiere.',
    ]);
    expect(sections[1].source).toBe('manual');
    expect(sections[0].source).toBe('auto');
    expect(sections[2].source).toBe('auto');
  });

  it('split setzt eine zusätzliche Grenze an einem Punkt', () => {
    const manual: ManualRange[] = [{ id: 's1', type: 'split', start: 4, end: 4 }];
    expect(texts('Hund läuft', cfg({ newlineMode: 'none' }), manual)).toEqual(['Hund', 'läuft']);
  });

  it('ignoriert überschneidende manuelle Bereiche (früherer gewinnt)', () => {
    const manual: ManualRange[] = [
      { id: 'a', type: 'section', start: 0, end: 15 },
      { id: 'b', type: 'section', start: 10, end: 27 },
    ];
    const sections = buildTextSections(raw, cfg(), manual);
    // Der erste Bereich (0–15) bleibt, der überlappende (10–27) wird verworfen.
    expect(sections[0].text).toBe('Heute gehen wir');
    expect(sections[0].source).toBe('manual');
  });
});

describe('buildTextSections – stabile IDs', () => {
  it('leitet IDs aus den Positionen ab und ist reproduzierbar', () => {
    const first = buildTextSections('Haus. Baum.', cfg());
    const second = buildTextSections('Haus. Baum.', cfg());
    expect(first).toEqual(second);
    expect(first.map((s) => s.id)).toEqual(['s-0-5', 's-6-11']);
  });
});
