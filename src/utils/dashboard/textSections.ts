/**
 * Zentrale, reine Textaufteilung für den Reiter "Text" (siehe Feinkonzept
 * docs/text-import-feinkonzept.md). Eine einzige Funktion erzeugt aus Rohtext,
 * Trennregeln und manuellen Bereichen reproduzierbar dieselben Abschnitte –
 * ohne globalen Zustand zu verändern.
 *
 * Positionen (start/end) beziehen sich auf den NORMALISIERTEN Text (\r\n und \r
 * zu \n vereinheitlicht). Die Funktion normalisiert defensiv selbst; in der
 * Produktion wird der Rohtext bereits bei Eingabe/Upload normalisiert, sodass
 * manuelle Bereiche und Abschnittspositionen im selben Koordinatensystem liegen.
 */

export type NewlineMode = 'none' | 'line' | 'paragraph';

export interface CustomDelimiter {
  id: string;
  /** Wörtliche Zeichenfolge (kein regulärer Ausdruck), mind. 1 Zeichen. */
  value: string;
}

export interface TextSplitConfig {
  newlineMode: NewlineMode;
  /** Ausgewählte Einzel-Trennzeichen, je genau ein Zeichen (z. B. '.', '!', '?'). */
  punctuation: string[];
  customDelimiters: CustomDelimiter[];
  /** Mehrere aufeinanderfolgende Separatoren zu einer Grenze zusammenfassen. */
  groupConsecutiveSeparators: boolean;
}

export type ManualRangeType = 'section' | 'split';

export interface ManualRange {
  id: string;
  type: ManualRangeType;
  /** Bei 'split' ist end === start (Grenze an einem Punkt). */
  start: number;
  end: number;
}

export interface TextSection {
  /** Stabil, aus den finalen Positionen abgeleitet: `s-<start>-<end>`. */
  id: string;
  start: number;
  end: number;
  text: string;
  source: 'auto' | 'manual';
}

export const DEFAULT_SPLIT_CONFIG: TextSplitConfig = {
  newlineMode: 'line',
  punctuation: ['.', '!', '?'],
  customDelimiters: [],
  groupConsecutiveSeparators: true,
};

// Schließende Anführungszeichen/Klammern, die nach einem Satzzeichen noch mit
// an den vorherigen Abschnitt gezogen werden (Feinkonzept, Entscheidung C).
const CLOSING_CHARS = new Set(['"', "'", '”', '’', '“', '»', '›', ')', ']', '}']);

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';

/** Eine Trennstelle: der Abschnitt endet bei cutStart, der nächste beginnt bei cutEnd. */
interface Break {
  cutStart: number;
  cutEnd: number;
}

/** Ein erkannter Separator im Rohtext. */
interface SeparatorMatch {
  start: number;
  end: number;
  /** 'keep' = Zeichen bleibt am vorherigen Abschnitt; 'consume' = wird entfernt. */
  kind: 'keep' | 'consume';
}

/** Findet alle automatischen Separatoren in einem einzigen Links-nach-rechts-Lauf. */
const findSeparators = (text: string, config: TextSplitConfig): SeparatorMatch[] => {
  const n = text.length;
  const punctuation = new Set(config.punctuation.filter((c) => c.length > 0));
  // Längster Treffer zuerst (Feinkonzept: |||, dann ||, dann |).
  const delimiters = config.customDelimiters
    .filter((d) => d.value.length > 0)
    .map((d) => d.value)
    .sort((a, b) => b.length - a.length);

  const matches: SeparatorMatch[] = [];
  let i = 0;

  while (i < n) {
    // 1. Benutzerdefinierte Zeichenfolgen (wörtlich, längster Treffer zuerst).
    let matchedDelimiter = false;
    for (const value of delimiters) {
      if (text.startsWith(value, i)) {
        matches.push({ start: i, end: i + value.length, kind: 'consume' });
        i += value.length;
        matchedDelimiter = true;
        break;
      }
    }
    if (matchedDelimiter) continue;

    const ch = text[i];

    // 2. Zeilenumbrüche.
    if (ch === '\n') {
      if (config.newlineMode === 'line') {
        matches.push({ start: i, end: i + 1, kind: 'consume' });
        i += 1;
        continue;
      }
      if (config.newlineMode === 'paragraph') {
        // Absatzgrenze = Leerzeile: mind. zwei \n, ggf. durch Leerzeichen/Tabs
        // getrennt. Ein einzelnes \n bleibt normaler Text im Abschnitt.
        let j = i;
        let newlineCount = 0;
        while (j < n && (text[j] === '\n' || text[j] === ' ' || text[j] === '\t')) {
          if (text[j] === '\n') newlineCount += 1;
          j += 1;
        }
        if (newlineCount >= 2) {
          matches.push({ start: i, end: j, kind: 'consume' });
          i = j;
          continue;
        }
      }
      // 'none' oder einzelnes \n im Absatzmodus: als normaler Text behandeln.
      i += 1;
      continue;
    }

    // 3. Ausgewählte Einzel-Trennzeichen.
    if (punctuation.has(ch)) {
      // Ziffernschutz (Feinkonzept, Entscheidung B): '.'/',' direkt zwischen
      // zwei Ziffern (z. B. 3.5) ist keine Grenze.
      if ((ch === '.' || ch === ',') && isDigit(text[i - 1]) && isDigit(text[i + 1])) {
        i += 1;
        continue;
      }
      // Lauf gleichartiger Satzzeichen zu EINER Grenze zusammenfassen (?!, !!!),
      // danach unmittelbar folgende schließende Anführungszeichen mitnehmen.
      let j = i + 1;
      while (j < n && punctuation.has(text[j])) j += 1;
      while (j < n && CLOSING_CHARS.has(text[j])) j += 1;
      matches.push({ start: i, end: j, kind: 'keep' });
      i = j;
      continue;
    }

    i += 1;
  }

  return matches;
};

/** Validiert manuelle 'section'-Bereiche: sortiert, überschneidungsfrei (früherer gewinnt). */
const validSectionRanges = (manualRanges: ManualRange[]): ManualRange[] => {
  const sections = manualRanges
    .filter((r) => r.type === 'section' && r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const valid: ManualRange[] = [];
  let lastEnd = -1;
  for (const r of sections) {
    if (r.start >= lastEnd) {
      valid.push(r);
      lastEnd = r.end;
    }
  }
  return valid;
};

/**
 * Erzeugt aus Rohtext, Trennregeln und manuellen Bereichen die endgültigen
 * Abschnitte. Wendet KEINE Ausschlüsse oder Umsortierungen an – das ist ein
 * separater Post-Schritt (siehe applyResultEdits).
 */
export const buildTextSections = (
  rawText: string,
  config: TextSplitConfig,
  manualRanges: ManualRange[] = []
): TextSection[] => {
  const text = rawText.replace(/\r\n?/g, '\n');
  const n = text.length;
  if (n === 0) return [];

  const sectionRanges = validSectionRanges(manualRanges);
  const splitPoints = manualRanges.filter((r) => r.type === 'split').map((r) => r.start);

  // Automatische Trennstellen …
  const autoBreaks: Break[] = findSeparators(text, config)
    .map((m): Break => (m.kind === 'keep' ? { cutStart: m.end, cutEnd: m.end } : { cutStart: m.start, cutEnd: m.end }))
    // … die echt innerhalb eines manuellen Abschnitts liegen, entfernen.
    .filter((b) => !sectionRanges.some((r) => b.cutStart > r.start && b.cutStart < r.end));

  const manualBreaks: Break[] = [];
  for (const r of sectionRanges) {
    manualBreaks.push({ cutStart: r.start, cutEnd: r.start });
    manualBreaks.push({ cutStart: r.end, cutEnd: r.end });
  }
  for (const p of splitPoints) {
    if (p > 0 && p < n) manualBreaks.push({ cutStart: p, cutEnd: p });
  }

  let breaks = [...autoBreaks, ...manualBreaks].sort(
    (a, b) => a.cutStart - b.cutStart || a.cutEnd - b.cutEnd
  );

  // Aufeinanderfolgende Separatoren (nur durch Whitespace getrennt) zu einer
  // Grenze zusammenfassen. Fängt auch überlappende Grenzen ab (leere Spanne).
  if (config.groupConsecutiveSeparators) {
    const merged: Break[] = [];
    for (const b of breaks) {
      const last = merged[merged.length - 1];
      if (last && text.slice(last.cutEnd, b.cutStart).trim() === '') {
        last.cutStart = Math.min(last.cutStart, b.cutStart);
        last.cutEnd = Math.max(last.cutEnd, b.cutEnd);
      } else {
        merged.push({ ...b });
      }
    }
    breaks = merged;
  }

  const sections: TextSection[] = [];
  const pushSegment = (a: number, b: number) => {
    const raw = text.slice(a, b);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const start = a + (raw.length - raw.trimStart().length);
    const end = start + trimmed.length;
    const source = sectionRanges.some((r) => start >= r.start && end <= r.end) ? 'manual' : 'auto';
    sections.push({ id: `s-${start}-${end}`, start, end, text: trimmed, source });
  };

  let prevEnd = 0;
  for (const b of breaks) {
    pushSegment(prevEnd, b.cutStart);
    prevEnd = Math.max(prevEnd, b.cutEnd);
  }
  pushSegment(prevEnd, n);

  return sections;
};
