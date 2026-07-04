import { describe, it, expect } from 'vitest';
import { parseMathLine, parseMathExpr, buildGapTask, generateMathLines, displayNum, type MathOp, type GenOptions } from './mathTasks';

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

  it('rechnet Geteilt, auch mit nicht-ganzzahligem Ergebnis (:, /, ÷)', () => {
    expect(parseMathLine('20:4')).toMatchObject({ prompt: '20 : 4', targetWord: '5' });
    expect(parseMathLine('20/4')).toMatchObject({ targetWord: '5' });
    expect(parseMathLine('7:2')).toMatchObject({ targetWord: '3.5' }); // manuell: nicht-ganzzahlig erlaubt
    expect(parseMathLine('5:0')).toBeNull(); // Division durch 0 bleibt verboten
  });

  it('gibt null bei ungültigen Zeilen', () => {
    expect(parseMathLine('abc')).toBeNull();
    expect(parseMathLine('4 + ')).toBeNull();
    expect(parseMathLine('')).toBeNull();
  });

  it('rechnet mit negativen Zahlen', () => {
    expect(parseMathLine('-4 + 7')).toMatchObject({ prompt: '-4 + 7', targetWord: '3' });
    expect(parseMathLine('3 - 10')).toMatchObject({ targetWord: '-7' });
    expect(parseMathLine('-3 * -2')).toMatchObject({ targetWord: '6' });
  });

  it('rechnet mit Dezimalzahlen (Komma oder Punkt)', () => {
    expect(parseMathLine('2,5 + 1,5')).toMatchObject({ prompt: '2,5 + 1,5', targetWord: '4' });
    expect(parseMathLine('2.5 + 1.5')).toMatchObject({ targetWord: '4' });
    expect(parseMathLine('0,1 + 0,2')).toMatchObject({ targetWord: '0.3' }); // kein Fließkomma-Rauschen
    expect(parseMathLine('-1,5 + 4')).toMatchObject({ targetWord: '2.5' });
  });
});

describe('displayNum', () => {
  it('zeigt Dezimalzahlen mit Komma statt Punkt', () => {
    expect(displayNum(3.5)).toBe('3,5');
    expect(displayNum(-2.25)).toBe('-2,25');
  });

  it('zeigt ganze Zahlen ohne Nachkommastellen', () => {
    expect(displayNum(4)).toBe('4');
    expect(displayNum(-7)).toBe('-7');
  });
});

describe('buildGapTask (Lückenaufgaben)', () => {
  it('versteckt den gewählten Slot und macht ihn zur Antwort', () => {
    const e = parseMathExpr('4 + 3')!;
    expect(buildGapTask(e, 'b')).toMatchObject({ prompt: '4 + _ = 7', targetWord: '3' });
    expect(buildGapTask(e, 'a')).toMatchObject({ prompt: '_ + 3 = 7', targetWord: '4' });
    expect(buildGapTask(e, 'result')).toMatchObject({ prompt: '4 + 3 = _', targetWord: '7' });
  });

  it('funktioniert auch mit Mal/Geteilt', () => {
    expect(buildGapTask(parseMathExpr('6 · 7')!, 'a')).toMatchObject({ prompt: '_ · 7 = 42', targetWord: '6' });
    expect(buildGapTask(parseMathExpr('20 : 4')!, 'b')).toMatchObject({ prompt: '20 : _ = 5', targetWord: '4' });
  });
});

describe('generateMathLines', () => {
  const allOps: MathOp[] = ['+', '-', '*', '/'];
  const base: Omit<GenOptions, 'ops'> = {
    minValue: 0,
    maxValue: 20,
    count: 7,
    allowNegativeResults: false,
    excludeZeroOperand: false,
    excludeZeroResult: false,
    multiplicationTables: [],
  };

  it('erzeugt die gewünschte Anzahl', () => {
    expect(generateMathLines({ ...base, ops: allOps })).toHaveLength(7);
  });

  it('hält den Zahlenraum bei Plus/Minus strikt ein (Operanden UND Ergebnis)', () => {
    for (const maxValue of [10, 20, 100]) {
      const lines = generateMathLines({ ...base, ops: ['+', '-'], maxValue, count: 300 });
      for (const line of lines) {
        const item = parseMathLine(line);
        expect(item, `parsebar: ${line}`).not.toBeNull();
        const operands = (line.match(/-?\d+/g) || []).map(Number);
        const answer = Number(item!.targetWord);
        expect(Math.max(...operands), `Operand <= ${maxValue}: ${line}`).toBeLessThanOrEqual(maxValue);
        expect(answer, `Ergebnis <= ${maxValue}: ${line}`).toBeLessThanOrEqual(maxValue);
        expect(answer, `Ergebnis >= 0 (keine negativen Ergebnisse): ${line}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('hält die untere Zahlenraum-Grenze (Von) bei Plus ein', () => {
    const lines = generateMathLines({ ...base, ops: ['+'], minValue: 10, maxValue: 20, count: 200 });
    for (const line of lines) {
      const operands = (line.match(/\d+/g) || []).map(Number);
      for (const n of operands) {
        expect(n, `Operand zwischen 10 und 20: ${line}`).toBeGreaterThanOrEqual(10);
        expect(n, `Operand zwischen 10 und 20: ${line}`).toBeLessThanOrEqual(20);
      }
    }
  });

  it('erlaubt negative Ergebnisse nur, wenn allowNegativeResults aktiv ist', () => {
    const lines = generateMathLines({
      ...base,
      ops: ['-'],
      minValue: 0,
      maxValue: 5,
      count: 200,
      allowNegativeResults: true,
    });
    const results = lines.map((l) => Number(parseMathLine(l)!.targetWord));
    // Bei kleinem Zahlenraum und vielen Versuchen sollte mindestens einmal ein
    // negatives Ergebnis vorkommen, wenn es ausdrücklich erlaubt ist.
    expect(results.some((r) => r < 0)).toBe(true);
  });

  it('vermeidet 0 als Rechenzahl, wenn excludeZeroOperand aktiv ist', () => {
    const lines = generateMathLines({
      ...base,
      ops: ['+', '-'],
      minValue: 0,
      maxValue: 5,
      count: 200,
      excludeZeroOperand: true,
    });
    for (const line of lines) {
      const operands = (line.match(/-?\d+/g) || []).map(Number);
      expect(operands.every((n) => n !== 0), `kein 0-Operand: ${line}`).toBe(true);
    }
  });

  it('vermeidet Ergebnis 0, wenn excludeZeroResult aktiv ist', () => {
    const lines = generateMathLines({
      ...base,
      ops: ['+', '-'],
      minValue: 0,
      maxValue: 10,
      count: 200,
      excludeZeroResult: true,
    });
    for (const line of lines) {
      const item = parseMathLine(line);
      expect(item, line).not.toBeNull();
      expect(Number(item!.targetWord), `Ergebnis != 0: ${line}`).not.toBe(0);
    }
  });

  it('liefert bei nur Division immer ganzzahlige, gültige Aufgaben', () => {
    const lines = generateMathLines({ ...base, ops: ['/'], count: 200 });
    for (const line of lines) {
      expect(parseMathLine(line), line).not.toBeNull();
    }
  });

  it('berücksichtigt die gewählten Einmaleins-Reihen bei Mal', () => {
    const lines = generateMathLines({ ...base, ops: ['*'], multiplicationTables: [5], count: 200 });
    for (const line of lines) {
      const expr = parseMathExpr(line);
      expect(expr, line).not.toBeNull();
      expect(expr!.a === 5 || expr!.b === 5, `5er-Reihe: ${line}`).toBe(true);
    }
  });

  it('berücksichtigt die gewählten Einmaleins-Reihen bei Geteilt', () => {
    const lines = generateMathLines({ ...base, ops: ['/'], multiplicationTables: [5], count: 200 });
    for (const line of lines) {
      const expr = parseMathExpr(line);
      expect(expr, line).not.toBeNull();
      expect(expr!.b, `Divisor 5: ${line}`).toBe(5);
    }
  });
});
