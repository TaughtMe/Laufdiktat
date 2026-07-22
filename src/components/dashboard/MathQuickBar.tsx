import { Sparkles } from 'lucide-react';
import type { MathOp } from '../../utils/dashboard/mathTasks';
import { MiniStepper } from './MiniStepper';

const OP_LABEL: Record<MathOp, string> = { '+': '+', '-': '−', '*': '·', '/': ':' };
const OP_TITLE: Record<MathOp, string> = {
  '+': 'Plus-Aufgaben',
  '-': 'Minus-Aufgaben',
  '*': 'Mal-Aufgaben',
  '/': 'Geteilt-Aufgaben',
};

interface MathQuickBarProps {
  mathPlus: boolean;
  setMathPlus: (fn: (v: boolean) => boolean) => void;
  mathMinus: boolean;
  setMathMinus: (fn: (v: boolean) => boolean) => void;
  mathMul: boolean;
  setMathMul: (fn: (v: boolean) => boolean) => void;
  mathDiv: boolean;
  setMathDiv: (fn: (v: boolean) => boolean) => void;
  mathMaxValue: number;
  setMathMaxValue: (n: number) => void;
  mathCount: number;
  setMathCount: (n: number) => void;
  onGenerate: () => void;
}

/**
 * Schnellleiste über der Mathe-Fläche: nur das Nötigste für den häufigsten
 * Fall (Rechenarten, obere Zahlenraum-Grenze, Anzahl, Erzeugen). Alles
 * Weitere (Zahlenraum-Untergrenze, Regeln, Lückenaufgaben, Einmaleins-Reihen)
 * lebt im MathSettingsPanel.
 */
export const MathQuickBar = ({
  mathPlus,
  setMathPlus,
  mathMinus,
  setMathMinus,
  mathMul,
  setMathMul,
  mathDiv,
  setMathDiv,
  mathMaxValue,
  setMathMaxValue,
  mathCount,
  setMathCount,
  onGenerate,
}: MathQuickBarProps) => {
  const opPill = (op: MathOp, active: boolean, onClick: () => void) => (
    <button
      key={op}
      type="button"
      onClick={onClick}
      title={OP_TITLE[op]}
      aria-pressed={active}
      className={`w-9 h-9 rounded-lg text-[15px] font-extrabold border transition-colors cursor-pointer shrink-0 ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-transparent text-ink-muted border-line hover:text-ink'
      }`}
    >
      {OP_LABEL[op]}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 shrink-0">
      <div className="flex items-center gap-1.5">
        {opPill('+', mathPlus, () => setMathPlus((v) => !v))}
        {opPill('-', mathMinus, () => setMathMinus((v) => !v))}
        {opPill('*', mathMul, () => setMathMul((v) => !v))}
        {opPill('/', mathDiv, () => setMathDiv((v) => !v))}
      </div>
      <div
        className="flex items-center gap-2"
        title="Höchster Wert in jeder Aufgabe (auch das Ergebnis) – gilt für alle Rechenarten"
      >
        <span className="text-[13px] font-bold text-ink">Bis:</span>
        <MiniStepper value={mathMaxValue} onChange={setMathMaxValue} min={-999} max={1000} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-ink">Anzahl:</span>
        <MiniStepper value={mathCount} onChange={setMathCount} min={1} max={50} />
      </div>
      <button
        type="button"
        onClick={onGenerate}
        className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-accent hover:opacity-90 text-white rounded-full font-bold text-[13px] transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
      >
        <Sparkles className="w-4 h-4" /> Aufgaben erzeugen
      </button>
    </div>
  );
};
