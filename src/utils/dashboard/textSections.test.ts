import { describe, it, expect } from 'vitest';
import {
  buildTextSections,
  applyResultEdits,
  sectionsToWords,
  DEFAULT_SPLIT_CONFIG,
  type TextSplitConfig,
  type CustomDelimiter,
  type ManualRange,
} from './textSections';

const cfg = (patch: Partial<TextSplitConfig> = {}): TextSplitConfig => ({
  ...DEFAULT_SPLIT_CONFIG,
  ...patch,
});

/** Nur die Regel „Zeichen", ohne Zeilenumbrüche – für Trennzeichen-Tests. */
const charsOnly = (punctuation: string[], patch: Partial<TextSplitConfig> = {}) =>
  cfg({ newlineEnabled: false, punctuation, ...patch });

const delim = (value: string): CustomDelimiter => ({ id: value, value });

/** Kurzform: nur die Abschnittstexte prüfen. */
const texts = (raw: string, config = cfg(), manual: ManualRange[] = []) =>
  buildTextSections(raw, config, manual).map((s) => s.text);

describe('buildTextSections – leere und triviale Eingaben', () => {
  it('gibt bei leerem Text [] zurück', () => {
    expect(buildTextSections('', cfg())).toEqual([]);
  });

  it('gibt bei reinem Whitespace [] zurück', () => {
    expect(buildTextSections('   \n  \t ', cfg())).toEqual([]);
  });

  it('erzeugt einen Abschnitt bei Text ohne Satzzeichen', () => {
    expect(texts('Ein Satz ohne Ende')).toEqual(['Ein Satz ohne Ende']);
  });
});

describe('buildTextSections – einzelne Trennzeichen', () => {
  it('nur Punkt aktiv: andere Satzzeichen bleiben Text', () => {
    expect(texts('Hallo. Was? Toll!', charsOnly(['.']))).toEqual(['Hallo.', 'Was? Toll!']);
  });

  it('Punkt, Ausrufe- und Fragezeichen aktiv', () => {
    expect(texts("Hallo. Wie geht's? Super!", charsOnly(['.', '!', '?']))).toEqual([
      'Hallo.',
      "Wie geht's?",
      'Super!',
    ]);
  });

  it('Komma aktiv', () => {
    expect(texts('Erst dies, dann das', charsOnly([',']))).toEqual(['Erst dies,', 'dann das']);
  });

  it('Doppelpunkt aktiv', () => {
    expect(texts('Merke: Das ist wichtig', charsOnly([':']))).toEqual(['Merke:', 'Das ist wichtig']);
  });

  it('Auslassungszeichen aktiv', () => {
    expect(texts('Und dann… Stille', charsOnly(['…']))).toEqual(['Und dann…', 'Stille']);
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

  it('fasst mehrere Satzzeichen zu einer Grenze zusammen (?!, !!!)', () => {
    expect(texts('Was?! Wirklich… Nein!!!', charsOnly(['.', '!', '?', '…']))).toEqual([
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
});

describe('buildTextSections – Hauptschalter Zeichen und Enter', () => {
  const raw = 'Ein Satz. Noch einer.\nZweite Zeile. Ende.';

  it('beide Regeln deaktiviert: genau ein Abschnitt', () => {
    expect(texts(raw, cfg({ punctuationEnabled: false, newlineEnabled: false }))).toEqual([raw]);
  });

  it('nur Zeichen aktiv: Zeilenumbruch bleibt Text', () => {
    expect(texts(raw, cfg({ punctuationEnabled: true, newlineEnabled: false }))).toEqual([
      'Ein Satz.',
      'Noch einer.',
      'Zweite Zeile.',
      'Ende.',
    ]);
  });

  it('nur Enter aktiv: Satzzeichen trennen nicht', () => {
    expect(texts(raw, cfg({ punctuationEnabled: false, newlineEnabled: true }))).toEqual([
      'Ein Satz. Noch einer.',
      'Zweite Zeile. Ende.',
    ]);
  });

  it('beide Regeln aktiv: Satzzeichen und Umbruch lösen beide eine Grenze aus', () => {
    expect(texts('Der Hund läuft. Die Katze schläft.\nDer Vogel fliegt.')).toEqual([
      'Der Hund läuft.',
      'Die Katze schläft.',
      'Der Vogel fliegt.',
    ]);
  });

  it('deaktivierte Regel „Zeichen" behält die Auswahl in der Config', () => {
    // Wichtig fürs UI: Ausschalten darf die getroffene Auswahl nicht verwerfen.
    const config = cfg({ punctuationEnabled: false, punctuation: ['.', '!', '?'] });
    expect(config.punctuation).toEqual(['.', '!', '?']);
    expect(texts('A. B.', config)).toEqual(['A. B.']);
  });

  it('deaktivierte eigene Trenner wirken nicht, bleiben aber erhalten', () => {
    const config = cfg({
      punctuationEnabled: false,
      newlineEnabled: false,
      customDelimiters: [delim('|||')],
    });
    expect(texts('A|||B', config)).toEqual(['A|||B']);
    expect(config.customDelimiters).toHaveLength(1);
  });
});

describe('buildTextSections – Zeilen und Absätze', () => {
  it('jede neue Zeile trennt', () => {
    expect(texts('Zeile1\nZeile2\nZeile3', cfg({ punctuationEnabled: false }))).toEqual([
      'Zeile1',
      'Zeile2',
      'Zeile3',
    ]);
  });

  it('mehrere Zeilenumbrüche erzeugen keine leeren Abschnitte', () => {
    expect(texts('A\n\n\nB')).toEqual(['A', 'B']);
  });

  it('nur Leerzeilen trennen, einzelne Umbrüche bleiben Text', () => {
    expect(
      texts('Abs1\nnochAbs1\n\nAbs2', cfg({ punctuationEnabled: false, newlineMode: 'paragraph' }))
    ).toEqual(['Abs1\nnochAbs1', 'Abs2']);
  });

  it('normalisiert LF', () => {
    expect(texts('A\nB', cfg({ punctuationEnabled: false }))).toEqual(['A', 'B']);
  });

  it('normalisiert CRLF', () => {
    expect(texts('A\r\nB', cfg({ punctuationEnabled: false }))).toEqual(['A', 'B']);
  });

  it('normalisiert einzelnes CR', () => {
    expect(texts('A\rB', cfg({ punctuationEnabled: false }))).toEqual(['A', 'B']);
  });

  it('behandelt gemischte Zeilenenden einheitlich', () => {
    expect(texts('A\r\nB\rC\nD', cfg({ punctuationEnabled: false }))).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('buildTextSections – benutzerdefinierte Trenner', () => {
  it('trennt bei einer Zeichenfolge und entfernt sie', () => {
    expect(texts('A|||B', charsOnly([], { customDelimiters: [delim('|||')] }))).toEqual(['A', 'B']);
  });

  it('behandelt Wort-Marker als wörtliche Zeichenfolge, nicht als RegExp', () => {
    expect(
      texts('Teil1[ABSCHNITT]Teil2', charsOnly([], { customDelimiters: [delim('[ABSCHNITT]')] }))
    ).toEqual(['Teil1', 'Teil2']);
  });

  it('unterstützt mehrere verschiedene eigene Trenner', () => {
    expect(
      texts('A|||B###C<NEU>D', charsOnly([], { customDelimiters: [delim('|||'), delim('###'), delim('<NEU>')] }))
    ).toEqual(['A', 'B', 'C', 'D']);
  });

  it('nimmt bei Überschneidung den längsten Treffer (Longest Match)', () => {
    expect(texts('A|||B', charsOnly([], { customDelimiters: [delim('|'), delim('|||')] }))).toEqual([
      'A',
      'B',
    ]);
  });

  it('ignoriert einen Trenner am Anfang', () => {
    expect(texts('|||A', charsOnly([], { customDelimiters: [delim('|||')] }))).toEqual(['A']);
  });

  it('ignoriert einen Trenner am Ende', () => {
    expect(texts('A|||', charsOnly([], { customDelimiters: [delim('|||')] }))).toEqual(['A']);
  });

  it('erzeugt bei mehreren Trennern hintereinander keine leeren Abschnitte', () => {
    expect(texts('A||||||B', charsOnly([], { customDelimiters: [delim('|||')] }))).toEqual(['A', 'B']);
  });

  it('verwirft leere Abschnitte zwischen Trennern und Whitespace', () => {
    expect(texts('A|||   |||B', charsOnly([], { customDelimiters: [delim('|||')] }))).toEqual(['A', 'B']);
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

  it('lässt automatische Regeln außerhalb des Bereichs unverändert', () => {
    // Beispiel aus der Spezifikation: der manuelle Bereich verschmilzt zwei
    // Sätze, die Grenzen davor und danach bleiben automatisch bestehen.
    const src = 'Der Hund läuft. Danach schläft er. Am Abend frisst er.';
    const start = src.indexOf('Danach');
    const end = src.indexOf(' frisst');
    const manual: ManualRange[] = [{ id: 'm1', type: 'section', start, end }];
    expect(texts(src, cfg({ newlineEnabled: false }), manual)).toEqual([
      'Der Hund läuft.',
      'Danach schläft er. Am Abend',
      'frisst er.',
    ]);
  });

  it('unterstützt mehrere getrennte manuelle Bereiche', () => {
    const src = 'Eins. Zwei. Drei. Vier. Fünf.';
    const manual: ManualRange[] = [
      { id: 'a', type: 'section', start: 0, end: 11 },
      { id: 'b', type: 'section', start: 18, end: 29 },
    ];
    const sections = buildTextSections(src, cfg({ newlineEnabled: false }), manual);
    expect(sections.map((s) => s.text)).toEqual(['Eins. Zwei.', 'Drei.', 'Vier. Fünf.']);
    expect(sections.map((s) => s.source)).toEqual(['manual', 'auto', 'manual']);
  });

  it('ersetzt überschneidende manuelle Bereiche definiert (früherer gewinnt)', () => {
    const manual: ManualRange[] = [
      { id: 'a', type: 'section', start: 0, end: 15 },
      { id: 'b', type: 'section', start: 10, end: 27 },
    ];
    const sections = buildTextSections(raw, cfg(), manual);
    expect(sections[0].text).toBe('Heute gehen wir');
    expect(sections[0].source).toBe('manual');
  });

  it('split setzt eine zusätzliche Grenze an einem Punkt', () => {
    const manual: ManualRange[] = [{ id: 's1', type: 'split', start: 4, end: 4 }];
    expect(texts('Hund läuft', cfg({ newlineEnabled: false }), manual)).toEqual(['Hund', 'läuft']);
  });

  it('erhält manuelle Bereiche über eine Regeländerung hinweg', () => {
    const src = 'Eins. Zwei.\nDrei. Vier.';
    const manual: ManualRange[] = [{ id: 'a', type: 'section', start: 0, end: 11 }];

    const ohneEnter = buildTextSections(src, cfg({ newlineEnabled: false }), manual);
    const mitEnter = buildTextSections(src, cfg({ newlineEnabled: true }), manual);

    // Der manuelle Abschnitt überlebt beide Regelstände unverändert …
    expect(ohneEnter[0].text).toBe('Eins. Zwei.');
    expect(ohneEnter[0].source).toBe('manual');
    expect(mitEnter[0].text).toBe('Eins. Zwei.');
    expect(mitEnter[0].source).toBe('manual');
    // … während die automatische Aufteilung dahinter identisch bleibt.
    expect(ohneEnter.slice(1).map((s) => s.text)).toEqual(['Drei.', 'Vier.']);
    expect(mitEnter.slice(1).map((s) => s.text)).toEqual(['Drei.', 'Vier.']);
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

describe('applyResultEdits – Ausschluss und Reihenfolge', () => {
  const sections = buildTextSections('Eins. Zwei. Drei.', cfg());

  it('gibt ohne Bearbeitung die Abschnitte in Dokumentreihenfolge zurück', () => {
    expect(applyResultEdits(sections).map((s) => s.text)).toEqual(['Eins.', 'Zwei.', 'Drei.']);
  });

  it('schließt Abschnitte per ID aus', () => {
    expect(applyResultEdits(sections, [sections[1].id]).map((s) => s.text)).toEqual(['Eins.', 'Drei.']);
  });

  it('ordnet nach der benutzerdefinierten Reihenfolge um', () => {
    const order = [sections[2].id, sections[0].id, sections[1].id];
    expect(applyResultEdits(sections, [], order).map((s) => s.text)).toEqual(['Drei.', 'Eins.', 'Zwei.']);
  });

  it('hängt nicht gelistete IDs stabil hinten an', () => {
    expect(applyResultEdits(sections, [], [sections[2].id]).map((s) => s.text)).toEqual([
      'Drei.',
      'Eins.',
      'Zwei.',
    ]);
  });

  it('verträgt IDs ausgeschlossener Abschnitte in der Reihenfolge', () => {
    // Die Verwaltung sortiert über ALLE Abschnitte, auch ausgeschlossene.
    const order = [sections[2].id, sections[1].id, sections[0].id];
    expect(applyResultEdits(sections, [sections[1].id], order).map((s) => s.text)).toEqual([
      'Drei.',
      'Eins.',
    ]);
  });

  it('kombiniert Ausschluss und Reihenfolge', () => {
    const order = [sections[2].id, sections[0].id];
    expect(applyResultEdits(sections, [sections[0].id], order).map((s) => s.text)).toEqual([
      'Drei.',
      'Zwei.',
    ]);
  });
});

describe('sectionsToWords – Ergebnis bis zur Spiel-Wortliste', () => {
  const rawText = 'Eins. Zwei. Drei.';
  const sections = buildTextSections(rawText, cfg());

  it('bildet Abschnitte auf WordItems ab', () => {
    expect(sectionsToWords(sections)).toEqual([
      { id: 's-0-5', targetWord: 'Eins.', isCompleted: false },
      { id: 's-6-11', targetWord: 'Zwei.', isCompleted: false },
      { id: 's-12-17', targetWord: 'Drei.', isCompleted: false },
    ]);
  });

  it('ausgeschlossene Abschnitte fehlen in der WordItem-Liste', () => {
    const words = sectionsToWords(applyResultEdits(sections, [sections[1].id]));
    expect(words.map((w) => w.targetWord)).toEqual(['Eins.', 'Drei.']);
  });

  it('Umsortierung verändert die WordItem-Reihenfolge', () => {
    const order = [sections[2].id, sections[0].id, sections[1].id];
    const words = sectionsToWords(applyResultEdits(sections, [], order));
    expect(words.map((w) => w.targetWord)).toEqual(['Drei.', 'Eins.', 'Zwei.']);
  });

  it('Umsortierung und Ausschluss verändern den Rohtext nicht', () => {
    const before = rawText;
    const order = [sections[2].id, sections[0].id];
    applyResultEdits(sections, [sections[1].id], order);
    sectionsToWords(applyResultEdits(sections, [sections[1].id], order));
    expect(rawText).toBe(before);
    // Der Rohtext ist ausschließlich Eingabe – die Abschnitte tragen weiterhin
    // ihre ursprünglichen Positionen in genau diesen Text.
    expect(sections.map((s) => rawText.slice(s.start, s.end))).toEqual(['Eins.', 'Zwei.', 'Drei.']);
  });
});
