import { describe, it, expect } from 'vitest';
import { parseMathLine, generateMathLines, type MathOp } from './mathTasks';

describe('parseMathLine', () => {
  it('rechnet Plus und Minus', () => {
    expect(parseMathLine('4+4')).toMatchObject({ prompt: '4 + 4', targetWord: '8' });
    expect(parseMathLine('12 - 5')).toMatchObject({ targetWord: '7' });
    expect(parseMathLine('10 − 3')).toMatchObject({ targetWord: '7' }); // echtes Minuszeichen
  });

  it('rechnet Mal (·, *, ×)', () => {
    expect(parseMathLine('6*7')).toMatchObject({ prompt: '6 · 7', targetWord: '42' });
    expect(parseMathLine('6·7')).toMatchObject({ targetWord: '42' });
    expect(parseMathLine('6×7')).toMatchObject({ targetWord: '42' });
  });

  it('rechnet Geteilt nur ganzzahlig (:, /, ÷)', () => {
    expect(parseMathLine('20:4')).toMatchObject({ prompt: '20 : 4', targetWord: '5' });
    expect(parseMathLine('20/4')).toMatchObject({ targetWord: '5' });
    expect(parseMathLine('7:2')).toBeNull(); // nicht ganzzahlig
    expect(parseMathLine('5:0')).toBeNull(); // Division durch 0
  });

  it('gibt null bei ungültigen Zeilen', () => {
    expect(parseMathLine('abc')).toBeNull();
    expect(parseMathLine('4 + ')).toBeNull();
    expect(parseMathLine('')).toBeNull();
  });
});

describe('generateMathLines', () => {
  const allOps: MathOp[] = ['+', '-', '*', '/'];

  it('erzeugt die gewünschte Anzahl', () => {
    expect(generateMathLines({ ops: allOps, max: 20, count: 7, noNegative: true })).toHaveLength(7);
  });

  it('hält den Zahlenraum strikt ein (Operanden UND Ergebnis)', () => {
    for (const max of [10, 20, 100]) {
      const lines = generateMathLines({ ops: allOps, max, count: 300, noNegative: true });
      for (const line of lines) {
        const item = parseMathLine(line);
        expect(item, `parsebar: ${line}`).not.toBeNull();
        const operands = (line.match(/\d+/g) || []).map(Number);
        const answer = Number(item!.targetWord);
        expect(Math.max(...operands), `Operand <= ${max}: ${line}`).toBeLessThanOrEqual(max);
        expect(answer, `Ergebnis <= ${max}: ${line}`).toBeLessThanOrEqual(max);
        expect(answer, `Ergebnis >= 0: ${line}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('liefert bei nur Division immer ganzzahlige, gültige Aufgaben', () => {
    const lines = generateMathLines({ ops: ['/'], max: 100, count: 200, noNegative: true });
    for (const line of lines) {
      expect(parseMathLine(line), line).not.toBeNull();
    }
  });
});
