import type { WordItem } from '../types/game';

export type MathOp = '+' | '-';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// Anzeige: echtes Minuszeichen, normales Plus.
const format = (a: number, op: MathOp, b: number) => `${a} ${op === '+' ? '+' : '−'} ${b}`;

/**
 * Parst eine Zeile wie "4+4" oder "12 − 5" sicher (kein eval) zu einem
 * Mathe-WordItem. Akzeptiert +, - und − als Operator. Gibt null bei ungültig.
 */
export const parseMathLine = (line: string): WordItem | null => {
  const m = line.trim().match(/^(-?\d+)\s*([+\-−])\s*(\d+)$/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const op: MathOp = m[2] === '+' ? '+' : '-';
  const b = parseInt(m[3], 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const answer = op === '+' ? a + b : a - b;
  return { id: uid(), prompt: format(a, op, b), targetWord: String(answer), isCompleted: false };
};

export interface GenOptions {
  ops: MathOp[];        // erlaubte Operationen
  max: number;          // größte vorkommende Zahl
  count: number;        // Anzahl Aufgaben
  noNegative: boolean;  // keine negativen Ergebnisse
}

/** Erzeugt zufällige Aufgaben-Zeilen (als Text), die dann normal geparst werden. */
export const generateMathLines = (opts: GenOptions): string[] => {
  const ops = opts.ops.length ? opts.ops : (['+'] as MathOp[]);
  const max = Math.max(1, opts.max);
  const rnd = () => Math.floor(Math.random() * (max + 1)); // 0..max
  const lines: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = rnd();
    let b = rnd();
    if (op === '-' && opts.noNegative && b > a) [a, b] = [b, a];
    lines.push(format(a, op, b));
  }
  return lines;
};
