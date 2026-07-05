import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { opSymbol, displayNum, MULTIPLICATION_TABLES, type MathExpr, type GapSlot } from '../../utils/dashboard/mathTasks';
import type { MathPreviewLine } from '../../hooks/dashboard/useMathImport';
import { MiniStepper } from './MiniStepper';
import { EmptyChips } from './EmptyChips';
import { MathDisplay } from '../shared/MathDisplay';

interface MathSettingsPanelProps {
  mathMinValue: number;
  setMathMinValue: (n: number) => void;
  mathMaxValue: number;
  setMathMaxValue: (n: number) => void;
  mathAllowNegative: boolean;
  setMathAllowNegative: (v: boolean) => void;
  mathExcludeZeroOperand: boolean;
  setMathExcludeZeroOperand: (v: boolean) => void;
  mathExcludeZeroResult: boolean;
  setMathExcludeZeroResult: (v: boolean) => void;
  mathGap: boolean;
  setMathGap: (v: boolean) => void;
  mathTables: number[];
  setMathTables: (tables: number[]) => void;
  /** Einmaleins-Reihen nur relevant/sichtbar, wenn Mal oder Geteilt aktiv ist. */
  showMultiplicationTables: boolean;
  mathExprs: MathExpr[];
  mathPreviewLines: MathPreviewLine[];
  mathGaps: GapSlot[];
  setGapAt: (index: number, slot: GapSlot) => void;
}

const CheckRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-[13px] font-semibold text-ink cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-[18px] h-[18px] accent-[var(--accent)] shrink-0"
    />
    {label}
  </label>
);

/**
 * Rechte Karte: zeigt standardmäßig die Vorschau. Ein Zahnrad-Icon oben
 * rechts öffnet die Einstellungen als Overlay, das nur den Vorschau-Bereich
 * bedeckt (nicht die Aufgabenliste links). Schließt sich per erneutem Klick
 * aufs Zahnrad oder Klick außerhalb der Overlay-Box.
 */
export const MathSettingsPanel = ({
  mathMinValue,
  setMathMinValue,
  mathMaxValue,
  setMathMaxValue,
  mathAllowNegative,
  setMathAllowNegative,
  mathExcludeZeroOperand,
  setMathExcludeZeroOperand,
  mathExcludeZeroResult,
  setMathExcludeZeroResult,
  mathGap,
  setMathGap,
  mathTables,
  setMathTables,
  showMultiplicationTables,
  mathExprs,
  mathPreviewLines,
  mathGaps,
  setGapAt,
}: MathSettingsPanelProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (overlayRef.current?.contains(target)) return;
      if (gearRef.current?.contains(target)) return;
      setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [settingsOpen]);

  const toggleTable = (n: number) => {
    setMathTables(mathTables.includes(n) ? mathTables.filter((t) => t !== n) : [...mathTables, n].sort((a, b) => a - b));
  };

  return (
    <div className="border border-line rounded-[22px] p-4 flex flex-col gap-2.5 min-h-[11rem] lg:min-h-0 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          {mathGap ? 'Vorschau (Lücken)' : 'Vorschau'}
        </span>
        <button
          ref={gearRef}
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          title="Mathe-Einstellungen"
          aria-label="Mathe-Einstellungen"
          aria-pressed={settingsOpen}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            settingsOpen ? 'bg-accent text-white' : 'text-ink-faint hover:text-ink hover:bg-surface-2'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        {/* Vorschau-Inhalt */}
        {mathPreviewLines.length === 0 ? (
          <EmptyChips text="Noch keine Aufgaben." sub="Die Vorschau erscheint, sobald Aufgaben da sind." />
        ) : mathGap ? (
          <div className="flex flex-col gap-1.5 overflow-y-auto h-full">
            <p className="text-[11px] text-ink-muted mb-1">Tippe die Zahl an, die zur Lücke (_) werden soll:</p>
            {mathExprs.map((e, i) => {
              const gap = mathGaps[i] ?? 'b';
              const numBtn = (slot: GapSlot, val: number) => (
                <button
                  type="button"
                  onClick={() => setGapAt(i, slot)}
                  className={`min-w-[2rem] px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                    gap === slot ? 'bg-warn text-white' : 'bg-surface-2 text-ink hover:bg-line'
                  }`}
                >
                  {gap === slot ? '_' : displayNum(val)}
                </button>
              );
              return (
                <div key={i} className="flex items-center gap-1.5 text-sm font-mono">
                  <span className="opacity-55 text-xs w-5 shrink-0 text-ink-muted">{i + 1}.</span>
                  {numBtn('a', e.a)}
                  <span className="text-ink-muted">{opSymbol(e.op)}</span>
                  {numBtn('b', e.b)}
                  <span className="text-ink-muted">=</span>
                  {numBtn('result', e.result)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 overflow-y-auto h-full">
            {mathPreviewLines.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-[13.5px] font-mono">
                <span className="text-ink-faint text-xs w-6 shrink-0 text-right">{i + 1}.</span>
                {entry.type === 'simple' ? (
                  <span className="font-bold text-ink">{`${displayNum(entry.expr.a)} ${opSymbol(entry.expr.op)} ${displayNum(entry.expr.b)} = ${displayNum(entry.expr.result)}`}</span>
                ) : (
                  <span className="font-bold text-ink inline-flex items-center gap-1.5">
                    <MathDisplay text={entry.line} isLatex /> <span>= {displayNum(entry.value)}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Einstellungen-Overlay: legt sich nur über die Vorschau, nicht über die Aufgabenliste. */}
        {settingsOpen && (
          <div
            ref={overlayRef}
            className="absolute inset-0 z-10 bg-surface border border-line rounded-[14px] shadow-lg p-3.5 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-4"
          >
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Zahlenraum</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-ink">Von:</span>
                  <MiniStepper value={mathMinValue} onChange={setMathMinValue} min={-1000} max={999} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-ink">Bis:</span>
                  <MiniStepper value={mathMaxValue} onChange={setMathMaxValue} min={-999} max={1000} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Regeln</h4>
              <div className="flex flex-col gap-2">
                <CheckRow label="Negative Ergebnisse zulassen" checked={mathAllowNegative} onChange={setMathAllowNegative} />
                <CheckRow label="0 als Rechenzahl vermeiden" checked={mathExcludeZeroOperand} onChange={setMathExcludeZeroOperand} />
                <CheckRow label="Ergebnis 0 vermeiden" checked={mathExcludeZeroResult} onChange={setMathExcludeZeroResult} />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Aufgabenform</h4>
              <CheckRow label="Lückenaufgaben" checked={mathGap} onChange={setMathGap} />
            </div>

            {showMultiplicationTables && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Einmaleins-Reihen</h4>
                <div className="flex flex-wrap gap-1.5">
                  {MULTIPLICATION_TABLES.map((n) => {
                    const active = mathTables.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleTable(n)}
                        aria-pressed={active}
                        className={`w-8 h-8 rounded-lg text-[13px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-accent text-white border-accent'
                            : 'bg-transparent text-ink-muted border-line hover:text-ink'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
