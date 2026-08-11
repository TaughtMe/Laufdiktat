import { useEffect, useState } from 'react';
import {
  parseMathExpr,
  generateMathLines,
  normalMathWord,
  buildGapTask,
  buildLatexMathWord,
  type MathExpr,
  type MathOp,
  type GapSlot,
  type GenOptions,
} from '../../utils/dashboard/mathTasks';
import { evaluateLatexExpr } from '../../utils/dashboard/latexMath';
import type { WordItem } from '../../types/game';

type ImportMode = 'text' | 'math' | 'vocabulary';

/** Eine gültige Vorschau-Zeile in Dokument-Reihenfolge: entweder einfaches
 * "a op b"-Format oder eine komplexere LaTeX-Zeile (Bruch/Potenz/Wurzel). */
export type MathPreviewLine =
  | { type: 'simple'; expr: MathExpr }
  | { type: 'latex'; line: string; value: number };

interface UseMathImportArgs {
  importMode: ImportMode;
  setWords: (words: WordItem[]) => void;
}

/**
 * Kapselt den Mathe-Import: Generator-Optionen, manuelle Eingabe,
 * Lückenaufgaben und das Aktualisieren der Wörter im Store.
 */
export const useMathImport = ({ importMode, setWords }: UseMathImportArgs) => {
  // Generator + manuelle Eingabe – beides läuft über mathInput
  const [mathInput, setMathInput] = useState('');
  const [mathPlus, setMathPlus] = useState(true);
  const [mathMinus, setMathMinus] = useState(true);
  const [mathMul, setMathMul] = useState(false);
  const [mathDiv, setMathDiv] = useState(false);
  const [mathCount, setMathCount] = useState(10);
  const [mathMinValueRaw, setMathMinValueRaw] = useState(0);
  const [mathMaxValueRaw, setMathMaxValueRaw] = useState(20);
  // Negative Ergebnisse sind jetzt eine Opt-in-Option (Default aus).
  const [mathAllowNegative, setMathAllowNegative] = useState(false);
  const [mathExcludeZeroOperand, setMathExcludeZeroOperand] = useState(false);
  const [mathExcludeZeroResult, setMathExcludeZeroResult] = useState(false);
  // Einmaleins-Reihen für Mal/Geteilt. Default: leer = gesamtes 1×1 (1–10).
  // Bewusst leer statt alle aktiv, damit man gezielt eine Reihe anwählt, statt
  // erst alle anderen abwählen zu müssen. Leer ODER alle ausgewählt = 1–10
  // (der Generator behandelt ein leeres Array als "alle Reihen").
  const [mathTables, setMathTables] = useState<number[]>([]);
  // Lückenaufgaben: an/aus + Lücken-Position je Aufgabe (Index -> 'a'|'b'|'result').
  const [mathGap, setMathGap] = useState(false);
  const [mathGaps, setMathGaps] = useState<GapSlot[]>([]);

  // Von/Bis halten sich gegenseitig konsistent (Von darf Bis nicht überschreiten).
  const setMathMinValue = (n: number) => {
    setMathMinValueRaw(n);
    setMathMaxValueRaw((prev) => (n > prev ? n : prev));
  };
  const setMathMaxValue = (n: number) => {
    setMathMaxValueRaw(n);
    setMathMinValueRaw((prev) => (n < prev ? n : prev));
  };

  // Alle gültigen Zeilen aus dem Eingabefeld in Dokument-Reihenfolge: entweder
  // einfaches "a op b"-Format oder eine komplexere LaTeX-Zeile
  // (Bruch/Potenz/Wurzel, siehe latexMath.ts). Ungültige Zeilen fehlen hier
  // bewusst (werden übersprungen, siehe MathTaskList für die "ungültig"-Anzeige).
  const mathPreviewLines: MathPreviewLine[] = mathInput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line): MathPreviewLine | null => {
      const expr = parseMathExpr(line);
      if (expr) return { type: 'simple', expr };
      const value = evaluateLatexExpr(line);
      return value !== null ? { type: 'latex', line, value } : null;
    })
    .filter((e): e is MathPreviewLine => e !== null);

  // Nur das einfache "a op b"-Format – wird für Lückenaufgaben-Steuerung
  // (Lücken gelten nur fürs einfache Format) und Zähler-Anzeigen genutzt.
  const mathExprs = mathPreviewLines
    .filter((l): l is Extract<MathPreviewLine, { type: 'simple' }> => l.type === 'simple')
    .map((l) => l.expr);

  // Mathe-Wörter im Store aktuell halten (normal, Lückenaufgabe oder
  // komplexere manuelle Eingabe mit Bruch/Potenz/Wurzel). Lücken gelten nur
  // fürs einfache Format – der Lücken-Index zählt deshalb nur einfache
  // Zeilen mit (entspricht der Reihenfolge, die die Vorschau-UI anzeigt).
  useEffect(() => {
    if (importMode !== 'math') return;
    const items: WordItem[] = [];
    let simpleIdx = 0;
    for (const entry of mathPreviewLines) {
      if (entry.type === 'simple') {
        items.push(mathGap ? buildGapTask(entry.expr, mathGaps[simpleIdx] ?? 'b') : normalMathWord(entry.expr));
        simpleIdx++;
        continue;
      }
      const latexWord = buildLatexMathWord(entry.line);
      if (latexWord) items.push(latexWord);
    }
    setWords(items);
    // mathPreviewLines wird aus mathInput abgeleitet und ändert sich nur,
    // wenn sich mathInput ändert – daher genügt mathInput als Dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importMode, mathInput, mathGap, mathGaps, setWords]);

  const currentOps = (): MathOp[] => {
    const ops: MathOp[] = [];
    if (mathPlus) ops.push('+');
    if (mathMinus) ops.push('-');
    if (mathMul) ops.push('*');
    if (mathDiv) ops.push('/');
    return ops.length ? ops : ['+'];
  };

  /** Baut die aktuellen Generator-Optionen aus dem Hook-State (fürs Erzeugen und für Einzel-Reroll). */
  const buildGenOptions = (ops: MathOp[] = currentOps()): GenOptions => ({
    ops,
    minValue: mathMinValueRaw,
    maxValue: mathMaxValueRaw,
    count: 1,
    allowNegativeResults: mathAllowNegative,
    excludeZeroOperand: mathExcludeZeroOperand,
    excludeZeroResult: mathExcludeZeroResult,
    multiplicationTables: mathTables,
  });

  const handleMathInputChange = (value: string) => {
    setMathInput(value);
  };

  const handleGenerateMath = () => {
    const ops = currentOps();
    const lines = generateMathLines({ ...buildGenOptions(ops), count: mathCount });
    setMathInput(lines.join('\n'));
    setMathGaps([]); // neue Aufgaben -> Lücken auf Standard zurücksetzen
  };

  const setGapAt = (index: number, slot: GapSlot) => {
    setMathGaps((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push('b');
      next[index] = slot;
      return next;
    });
  };

  return {
    mathInput,
    mathPlus,
    setMathPlus,
    mathMinus,
    setMathMinus,
    mathMul,
    setMathMul,
    mathDiv,
    setMathDiv,
    mathCount,
    setMathCount,
    mathMinValue: mathMinValueRaw,
    setMathMinValue,
    mathMaxValue: mathMaxValueRaw,
    setMathMaxValue,
    mathAllowNegative,
    setMathAllowNegative,
    mathExcludeZeroOperand,
    setMathExcludeZeroOperand,
    mathExcludeZeroResult,
    setMathExcludeZeroResult,
    mathTables,
    setMathTables,
    mathGap,
    setMathGap,
    mathGaps,
    mathExprs,
    mathPreviewLines,
    handleMathInputChange,
    handleGenerateMath,
    setGapAt,
    currentOps,
    buildGenOptions,
  };
};
