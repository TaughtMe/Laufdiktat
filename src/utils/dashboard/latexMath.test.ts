import { describe, it, expect } from 'vitest';
import { evaluateLatexExpr } from './latexMath';

describe('evaluateLatexExpr', () => {
  it('rechnet Grundrechenarten', () => {
    expect(evaluateLatexExpr('4 + 4')).toBe(8);
    expect(evaluateLatexExpr('10 - 3')).toBe(7);
    expect(evaluateLatexExpr('6 * 7')).toBe(42);
    expect(evaluateLatexExpr('20 / 4')).toBe(5);
  });

  it('beachtet Punkt-vor-Strich und Klammern', () => {
    expect(evaluateLatexExpr('2 + 3 * 4')).toBe(14);
    expect(evaluateLatexExpr('(2 + 3) * 4')).toBe(20);
  });

  it('rechnet negative Zahlen', () => {
    expect(evaluateLatexExpr('-4 + 7')).toBe(3);
    expect(evaluateLatexExpr('3 * -2')).toBe(-6);
  });

  it('rechnet Dezimalzahlen (Komma oder Punkt)', () => {
    expect(evaluateLatexExpr('2,5 + 1,5')).toBe(4);
    expect(evaluateLatexExpr('2.5 + 1.5')).toBe(4);
  });

  it('rechnet Potenzen (^), rechtsassoziativ', () => {
    expect(evaluateLatexExpr('2^3')).toBe(8);
    expect(evaluateLatexExpr('2^3^2')).toBe(2 ** (3 ** 2));
    expect(evaluateLatexExpr('-2^2')).toBe(-4); // unär bindet schwaecher als ^
  });

  it('rechnet Brüche über \\frac{}{}', () => {
    expect(evaluateLatexExpr('\\frac{1}{2}')).toBe(0.5);
    expect(evaluateLatexExpr('\\frac{1}{2} + \\frac{1}{4}')).toBe(0.75);
    expect(evaluateLatexExpr('\\frac{1}{0}')).toBeNull(); // Division durch 0
  });

  it('rechnet Wurzeln über \\sqrt{} (Standard: Quadratwurzel)', () => {
    expect(evaluateLatexExpr('\\sqrt{9}')).toBe(3);
    expect(evaluateLatexExpr('\\sqrt{16} + 2')).toBe(6);
  });

  it('rechnet höhere Wurzeln über \\sqrt[n]{}', () => {
    expect(evaluateLatexExpr('\\sqrt[3]{8}')).toBe(2);
    expect(evaluateLatexExpr('\\sqrt[3]{-8}')).toBe(-2); // ungerade Wurzel aus negativer Zahl ok
  });

  it('lehnt gerade Wurzel aus negativer Zahl ab', () => {
    expect(evaluateLatexExpr('\\sqrt{-4}')).toBeNull();
  });

  it('kombiniert Brüche, Potenzen und Wurzeln', () => {
    expect(evaluateLatexExpr('\\sqrt{\\frac{16}{4}}')).toBe(2);
    expect(evaluateLatexExpr('2^{\\frac{1}{1}}')).toBe(2);
  });

  it('gibt null bei ungültiger oder unvollständiger Syntax zurück', () => {
    expect(evaluateLatexExpr('')).toBeNull();
    expect(evaluateLatexExpr('abc')).toBeNull();
    expect(evaluateLatexExpr('4 +')).toBeNull();
    expect(evaluateLatexExpr('\\frac{1}{2')).toBeNull(); // fehlende Klammer
    expect(evaluateLatexExpr('4 + 4 )')).toBeNull(); // überzählige Klammer
    expect(evaluateLatexExpr('\\unknown{1}')).toBeNull();
  });
});
