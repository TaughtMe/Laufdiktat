import type { WordItem } from '../../types/game';

export type MathOp = '+' | '-' | '*' | '/';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// Anzeige: deutsches Schul-Format (· für mal, : für geteilt, − für minus).
const sym = (op: MathOp) => (op === '+' ? '+' : op === '-' ? '−' : op === '*' ? '·' : ':');
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

export interface GenOptions {
  ops: MathOp[];        // erlaubte Operationen
  max: number;          // größte vorkommende Zahl
  count: number;        // Anzahl Aufgaben
  noNegative: boolean;  // keine negativen Ergebnisse (nur für −)
}

/**
 * Erzeugt zufällige Aufgaben-Zeilen (als Text), die dann normal geparst werden.
 * Der Zahlenraum (max) wird strikt eingehalten: Operanden UND Ergebnis bleiben
 * im Bereich 0..max (bei − optional negativ, wenn nicht verboten).
 */
export const generateMathLines = (opts: GenOptions): string[] => {
  const ops = opts.ops.length ? opts.ops : (['+'] as MathOp[]);
  const max = Math.max(1, opts.max);
  const rnd = (n: number) => Math.floor(Math.random() * (Math.max(0, n) + 1)); // 0..n
  const factorLim = Math.min(max, 12); // kleine Faktoren/Teiler (kleines 1·1)
  const lines: string[] = [];

  for (let i = 0; i < opts.count; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    if (op === '+') {
      const a = rnd(max);
      const b = rnd(max - a); // Summe a + b <= max
      lines.push(format(a, '+', b));
    } else if (op === '-') {
      const a = rnd(max);
      const b = rnd(opts.noNegative ? a : max); // kein negatives Ergebnis, wenn verboten
      lines.push(format(a, '-', b));
    } else if (op === '*') {
      const a = 1 + rnd(factorLim - 1); // 1..factorLim
      const b = rnd(Math.min(factorLim, Math.floor(max / a))); // Produkt a · b <= max
      lines.push(format(a, '*', b));
    } else {
      // Division: Divisor · Quotient = Dividend, alles <= max, ganzzahlig.
      const b = 1 + rnd(factorLim - 1); // Divisor 1..factorLim
      const q = rnd(Math.floor(max / b)); // Quotient -> Dividend b·q <= max
      lines.push(format(b * q, '/', b));
    }
  }
  return lines;
};
