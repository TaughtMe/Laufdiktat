import { useEffect, useState } from 'react';
import {
  parseMathExpr,
  generateMathLines,
  normalMathWord,
  buildGapTask,
  MULTIPLICATION_TABLES,
  type MathOp,
  type GapSlot,
  type GenOptions,
} from '../../utils/dashboard/mathTasks';
import type { WordItem } from '../../types/game';

type ImportMode = 'lines' | 'sentences' | 'manual' | 'math';

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
  // Einmaleins-Reihen für Mal/Geteilt (Default: alle 1–10 aktiv).
  const [mathTables, setMathTables] = useState<number[]>([...MULTIPLICATION_TABLES]);
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

  // Geparste Mathe-Ausdrücke aus dem Eingabefeld (ungültige Zeilen ignoriert).
  const mathExprs = mathInput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseMathExpr)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  // Mathe-Wörter im Store aktuell halten (normal oder Lückenaufgaben).
  useEffect(() => {
    if (importMode !== 'math') return;
    const items = mathGap
      ? mathExprs.map((e, i) => buildGapTask(e, mathGaps[i] ?? 'b'))
      : mathExprs.map(normalMathWord);
    setWords(items);
    // mathExprs ist von mathInput abgeleitet -> mathInput als Dep genügt.
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
    handleMathInputChange,
    handleGenerateMath,
    setGapAt,
    currentOps,
    buildGenOptions,
  };
};
