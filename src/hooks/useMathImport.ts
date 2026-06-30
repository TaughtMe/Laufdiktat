import { useEffect, useState } from 'react';
import {
  parseMathExpr,
  generateMathLines,
  normalMathWord,
  buildGapTask,
  type MathOp,
  type GapSlot,
} from '../utils/mathTasks';
import type { WordItem } from '../types/game';

type ImportMode = 'lines' | 'sentences' | 'manual' | 'math';

interface UseMathImportArgs {
  importMode: ImportMode;
  setWords: (words: WordItem[]) => void;
}

/**
 * Kapselt den Mathe-Import: Generator-Optionen, manuelle Eingabe,
 * Lückenaufgaben und das Aktualisieren der Wörter im Store.
 * Verhalten unverändert gegenüber der vorherigen Inline-Version.
 */
export const useMathImport = ({ importMode, setWords }: UseMathImportArgs) => {
  // Generator + manuelle Eingabe – beides läuft über mathInput
  const [mathInput, setMathInput] = useState('');
  const [mathPlus, setMathPlus] = useState(true);
  const [mathMinus, setMathMinus] = useState(true);
  const [mathMul, setMathMul] = useState(false);
  const [mathDiv, setMathDiv] = useState(false);
  const [mathMax, setMathMax] = useState(20);
  const [mathCount, setMathCount] = useState(10);
  const [mathNoNeg, setMathNoNeg] = useState(true);
  // Lückenaufgaben: an/aus + Lücken-Position je Aufgabe (Index -> 'a'|'b'|'result').
  const [mathGap, setMathGap] = useState(false);
  const [mathGaps, setMathGaps] = useState<GapSlot[]>([]);

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

  const handleMathInputChange = (value: string) => {
    setMathInput(value);
  };

  const handleGenerateMath = () => {
    const ops: MathOp[] = [];
    if (mathPlus) ops.push('+');
    if (mathMinus) ops.push('-');
    if (mathMul) ops.push('*');
    if (mathDiv) ops.push('/');
    if (ops.length === 0) ops.push('+');
    const lines = generateMathLines({ ops, max: mathMax, count: mathCount, noNegative: mathNoNeg });
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
    mathMax,
    setMathMax,
    mathCount,
    setMathCount,
    mathNoNeg,
    setMathNoNeg,
    mathGap,
    setMathGap,
    mathGaps,
    mathExprs,
    handleMathInputChange,
    handleGenerateMath,
    setGapAt,
  };
};
