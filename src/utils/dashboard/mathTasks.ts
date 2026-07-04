import type { WordItem } from '../../types/game';

export type MathOp = '+' | '-' | '*' | '/';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// Anzeige: deutsches Schul-Format (· für mal, : für geteilt, − für minus).
export const opSymbol = (op: MathOp) => (op === '+' ? '+' : op === '-' ? '−' : op === '*' ? '·' : ':');
const sym = opSymbol;
const format = (a: number, op: MathOp, b: number) => `${a} ${sym(op)} ${b}`;

const compute = (a: number, op: MathOp, b: number): number | null => {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 && a % b === 0 ? a / b : null; // nur ganzzahlige Division
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

/**
 * Parst eine Zeile wie "4+4", "12 − 5", "6·7" oder "20:4" sicher (kein eval)
 * in ihre Bestandteile. Akzeptiert +, -, −, *, ×, ·, /, :, ÷.
 * Division nur mit ganzzahligem Ergebnis, sonst null.
 */
export const parseMathExpr = (line: string): MathExpr | null => {
  const m = line.trim().match(/^(-?\d+)\s*([+\-−*×·/:÷])\s*(-?\d+)$/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const raw = m[2];
  const op: MathOp =
    raw === '+' ? '+'
    : raw === '-' || raw === '−' ? '-'
    : raw === '*' || raw === '×' || raw === '·' ? '*'
    : '/';
  const b = parseInt(m[3], 10);
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
 * Lückenaufgabe: eine Zahl der Gleichung wird durch "_" ersetzt, die gesuchte
 * Zahl ist die Antwort. Beispiel: gap 'b' -> "4 + _ = 7", Antwort "3".
 */
export const buildGapTask = (e: MathExpr, gap: GapSlot): WordItem => {
  const aS = gap === 'a' ? '_' : String(e.a);
  const bS = gap === 'b' ? '_' : String(e.b);
  const rS = gap === 'result' ? '_' : String(e.result);
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
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const a = randInt(opts.minValue, opts.maxValue);
    const b = randInt(opts.minValue, opts.maxValue);
    if (opts.excludeZeroOperand && (a === 0 || b === 0)) continue;
    const result = op === '+' ? a + b : a - b;
    if (result > opts.maxValue) continue; // Zahlenraum gilt auch fürs Ergebnis
    if (!opts.allowNegativeResults && result < 0) continue;
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
