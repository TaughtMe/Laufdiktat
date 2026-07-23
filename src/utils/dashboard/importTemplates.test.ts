import { describe, it, expect } from 'vitest';
import { TEXT_TEMPLATES, MATH_TEMPLATE } from './importTemplates';
import { parseMathExpr } from './mathTasks';
import { evaluateLatexExpr } from './latexMath';

/** Eine Zeile gilt als gültig, wenn sie der Mathe-Import auch akzeptiert. */
const lineParses = (line: string): boolean =>
  parseMathExpr(line) !== null || evaluateLatexExpr(line) !== null;

describe('importTemplates – Mathe-Vorlage', () => {
  const lines = MATH_TEMPLATE.content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  it('enthält mehrere Aufgaben', () => {
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });

  it('jede Zeile parst als gültige Aufgabe (kein „ungültig" beim Import)', () => {
    const invalid = lines.filter((l) => !lineParses(l));
    expect(invalid).toEqual([]);
  });

  it('enthält mindestens eine LaTeX-Aufgabe als Beispiel', () => {
    expect(lines.some((l) => l.includes('\\'))).toBe(true);
  });
});

describe('importTemplates – Text-Vorlagen', () => {
  it('sind alle nicht leer und eindeutig benannt', () => {
    const names = TEXT_TEMPLATES.map((t) => t.filename);
    expect(TEXT_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const t of TEXT_TEMPLATES) {
      expect(t.content.trim().length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('die Wortliste hat einen Eintrag pro Zeile (keine Satzzeichen als Trenner nötig)', () => {
    const wortliste = TEXT_TEMPLATES.find((t) => t.filename.includes('wortliste'));
    expect(wortliste).toBeDefined();
    const lines = wortliste!.content.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });
});
