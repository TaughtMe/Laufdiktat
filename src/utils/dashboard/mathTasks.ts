import type { WordItem } from '../../types/game';
import { evaluateLatexExpr } from './latexMath';

export type MathOp = '+' | '-' | '*' | '/';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// Anzeige: deutsches Schul-Format (· für mal, : für geteilt, − für minus).
export const opSymbol = (op: MathOp) => (op === '+' ? '+' : op === '-' ? '−' : op === '*' ? '·' : ':');
const sym = opSymbol;

// Rundet Fließkomma-Rauschen weg (z. B. 0.1 + 0.2 -> 0.30000000000000004),
// ohne echte Nachkommastellen zu verlieren.
const round = (n: number): number => Math.round(n * 1e9) / 1e9;

/** Zeigt eine Zahl im deutschen Format an (Komma statt Punkt, keine unnötigen Nachkommastellen). */
export const displayNum = (n: number): string => round(n).toString().replace('.', ',');

const format = (a: number, op: MathOp, b: number) => `${displayNum(a)} ${sym(op)} ${displayNum(b)}`;

const compute = (a: number, op: MathOp, b: number): number | null => {
  switch (op) {
    case '+': return round(a + b);
    case '-': return round(a - b);
    case '*': return round(a * b);
    // Manuelle Eingabe erlaubt auch nicht-ganzzahlige Ergebnisse (z. B. 7 : 2 = 3,5);
    // der Zufallsgenerator konstruiert Divisionen ohnehin immer exakt teilbar.
    case '/': return b !== 0 ? round(a / b) : null;
  }
};

export interface MathExpr {
  a: number;
  op: MathOp;
  b: number;
  result: number;
}

/** Wo die Lücke sitzt: erster Operand, zweiter Operand oder Ergebnis. */
export type GapSlot = 'a' | 'b' | 'result';

const parseNum = (s: string): number => parseFloat(s.replace(',', '.'));

/**
 * Parst eine Zeile wie "4+4", "12 − 5", "6·7", "20:4", "-3,5 + 2" oder
 * "7 : 2" (nicht-ganzzahliges Ergebnis 3,5) sicher (kein eval) in ihre
 * Bestandteile. Akzeptiert +, -, −, *, ×, ·, /, :, ÷. Operanden dürfen negativ
 * und/oder Dezimalzahlen sein (Komma oder Punkt).
 */
export const parseMathExpr = (line: string): MathExpr | null => {
  const m = line.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([+\-−*×·/:÷])\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const a = parseNum(m[1]);
  const raw = m[2];
  const op: MathOp =
    raw === '+' ? '+'
    : raw === '-' || raw === '−' ? '-'
    : raw === '*' || raw === '×' || raw === '·' ? '*'
    : '/';
  const b = parseNum(m[3]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const result = compute(a, op, b);
  if (result === null) return null;
  return { a, op, b, result };
};

/** Normale Aufgabe aus einem geparsten Ausdruck (Aufgabe zeigen, Ergebnis = Antwort). */
export const normalMathWord = (e: MathExpr): WordItem => ({
  id: uid(),
  prompt: format(e.a, e.op, e.b),
  targetWord: String(e.result),
  isCompleted: false,
});

/** Normale Aufgabe: Aufgabe anzeigen, Ergebnis ist die Antwort. */
export const parseMathLine = (line: string): WordItem | null => {
  const e = parseMathExpr(line);
  if (!e) return null;
  return normalMathWord(e);
};

/**
 * Baut eine Aufgabe aus einer komplexeren, LaTeX-ähnlichen Eingabe (Brüche
 * \frac{}{}, Wurzeln \sqrt{}/\sqrt[n]{}, Potenzen ^, Klammern) – die Zeile
 * selbst bleibt der Prompt (wird per KaTeX gerendert, siehe MathDisplay),
 * das berechnete Ergebnis ist die Antwort.
 */
export const buildLatexMathWord = (line: string): WordItem | null => {
  const value = evaluateLatexExpr(line);
  if (value === null) return null;
  return { id: uid(), prompt: line.trim(), targetWord: String(round(value)), isCompleted: false, isLatex: true };
};

/**
 * Manuelle Eingabe: versucht zuerst das einfache "a op b"-Format (unterstützt
 * Lückenaufgaben), fällt sonst auf die LaTeX-ähnliche Auswertung zurück
 * (nur normale Aufgaben, keine Lücken – Brüche/Potenzen/Wurzeln lassen sich
 * nicht sinnvoll in a/op/b/Ergebnis aufteilen). Nur für manuelle Eingabe
 * gedacht, nicht für den Zufallsgenerator.
 */
export const parseManualMathLine = (line: string, gap?: GapSlot): WordItem | null => {
  const e = parseMathExpr(line);
  if (e) return gap ? buildGapTask(e, gap) : normalMathWord(e);
  return buildLatexMathWord(line);
};

/**
 * Lückenaufgabe: eine Zahl der Gleichung wird durch "_" ersetzt, die gesuchte
 * Zahl ist die Antwort. Beispiel: gap 'b' -> "4 + _ = 7", Antwort "3".
 */
export const buildGapTask = (e: MathExpr, gap: GapSlot): WordItem => {
  const aS = gap === 'a' ? '_' : displayNum(e.a);
  const bS = gap === 'b' ? '_' : displayNum(e.b);
  const rS = gap === 'result' ? '_' : displayNum(e.result);
  const prompt = `${aS} ${sym(e.op)} ${bS} = ${rS}`;
  const answer = gap === 'a' ? e.a : gap === 'b' ? e.b : e.result;
  return { id: uid(), prompt, targetWord: String(answer), isCompleted: false };
};

/** Auswählbare Einmaleins-Reihen für Mal-/Geteilt-Aufgaben (kleines 1×1 bis 10×10). */
export const MULTIPLICATION_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface GenOptions {
  ops: MathOp[];        // erlaubte Operationen
  minValue: number;     // Zahlenraum: untere Grenze
  maxValue: number;     // Zahlenraum: obere Grenze
  count: number;        // Anzahl Aufgaben
  /** Negative Ergebnisse zulassen (nur relevant für −). Default: aus (keine negativen Ergebnisse). */
  allowNegativeResults: boolean;
  /** 0 als Rechenzahl (Operand) vermeiden. */
  excludeZeroOperand: boolean;
  /** Ergebnis 0 vermeiden. */
  excludeZeroResult: boolean;
  /** Einmaleins-Reihen für ·/: , z. B. [2, 5, 10]. Leeres Array = alle Reihen 1–10. */
  multiplicationTables: number[];
}

const randInt = (min: number, max: number): number => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
};

// Genug Versuche, um auch bei eng gewähltem Zahlenraum + mehreren aktiven
// Ausschlüssen (0 als Rechenzahl/Ergebnis, negative Ergebnisse aus) fast immer
// eine passende Kombination zu finden, ohne die UI spürbar zu blockieren.
const MAX_ATTEMPTS = 200;

const genAddSub = (op: '+' | '-', opts: GenOptions): { a: number; b: number } | null => {
  // Das Ergebnis muss regulär im selben Zahlenraum liegen wie die Operanden
  // (Untergrenze UND Obergrenze). "Negative Ergebnisse zulassen" ist ein
  // gezielter Zusatz-Override, damit z. B. bei Von=0 auch Ergebnisse wie
  // "3 − 8 = −5" erlaubt sind – er spiegelt den Zahlenraum dafür ins
  // Negative (mind. -maxValue), verengt eine bereits negative Untergrenze
  // aber nie.
  const resultFloor = opts.allowNegativeResults
    ? Math.min(opts.minValue, -opts.maxValue)
    : opts.minValue;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const a = randInt(opts.minValue, opts.maxValue);
    const b = randInt(opts.minValue, opts.maxValue);
    if (opts.excludeZeroOperand && (a === 0 || b === 0)) continue;
    const result = op === '+' ? a + b : a - b;
    if (result < resultFloor || result > opts.maxValue) continue; // Zahlenraum gilt auch fürs Ergebnis
    if (opts.excludeZeroResult && result === 0) continue;
    return { a, b };
  }
  return null;
};

const genMul = (opts: GenOptions): { a: number; b: number } | null => {
  const tables = opts.multiplicationTables.length ? opts.multiplicationTables : [...MULTIPLICATION_TABLES];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const table = tables[Math.floor(Math.random() * tables.length)];
    const factor = randInt(0, 10);
    if (opts.excludeZeroOperand && (table === 0 || factor === 0)) continue;
    const result = table * factor;
    if (opts.excludeZeroResult && result === 0) continue;
    // Reihenfolge zufällig, damit nicht immer die Einmaleins-Reihe zuerst steht.
    return Math.random() < 0.5 ? { a: table, b: factor } : { a: factor, b: table };
  }
  return null;
};

const genDiv = (opts: GenOptions): { a: number; b: number } | null => {
  const tables = opts.multiplicationTables.length ? opts.multiplicationTables : [...MULTIPLICATION_TABLES];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const divisor = tables[Math.floor(Math.random() * tables.length)];
    if (divisor === 0) continue;
    const quotient = randInt(0, 10);
    // quotient 0 -> Dividend (a) wäre 0 (Rechenzahl) UND Ergebnis wäre 0.
    if (opts.excludeZeroOperand && quotient === 0) continue;
    if (opts.excludeZeroResult && quotient === 0) continue;
    return { a: divisor * quotient, b: divisor };
  }
  return null;
};

/**
 * Erzeugt zufällige Aufgaben-Zeilen (als Text), die dann normal geparst
 * werden. Plus/Minus schöpfen aus dem Zahlenraum (minValue..maxValue,
 * Ergebnis eingeschlossen); Mal/Geteilt aus den gewählten Einmaleins-Reihen
 * (unabhängig vom Zahlenraum, wie im Unterricht üblich).
 */
export const generateMathLines = (opts: GenOptions): string[] => {
  const ops = opts.ops.length ? opts.ops : (['+'] as MathOp[]);
  const lines: string[] = [];

  for (let i = 0; i < opts.count; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    const pair =
      op === '+' || op === '-' ? genAddSub(op, opts)
      : op === '*' ? genMul(opts)
      : genDiv(opts);

    if (pair) {
      lines.push(format(pair.a, op, pair.b));
    } else {
      // Fallback, falls die Einstellungen-Kombination binnen der Versuche
      // nicht erfüllbar war (z. B. sehr enger Zahlenraum + viele Ausschlüsse).
      const safe = Math.max(opts.minValue, 1);
      lines.push(op === '/' ? '1 : 1' : op === '*' ? `${safe} · 1` : format(safe, op, op === '-' ? 0 : safe));
    }
  }
  return lines;
};
