import { useState } from 'react';
import { RefreshCw, X, Plus } from 'lucide-react';
import { parseMathExpr, opSymbol, displayNum } from '../../utils/dashboard/mathTasks';
import { evaluateLatexExpr } from '../../utils/dashboard/latexMath';
import { moveArrayItem } from '../../utils/dashboard/reorder';
import { EmptyChips } from './EmptyChips';
import { MathDisplay } from '../shared/MathDisplay';

interface MathTaskListProps {
  mathInput: string;
  validCount: number;
  onChangeLines: (lines: string[]) => void;
  /** Liefert eine neue zufällige Aufgaben-Zeile nach den aktuellen Einstellungen (fürs Neu-würfeln einer Zeile). */
  generateSingleLine: () => string;
}

/**
 * "Aufgabenliste": Zeilen einzeln bearbeiten/würfeln/löschen, per Drag & Drop
 * umsortieren, fortlaufend neue Aufgaben eintippen (Enter -> nächste Zeile,
 * leeres Enter beendet).
 */
export const MathTaskList = ({ mathInput, validCount, onChangeLines, generateSingleLine }: MathTaskListProps) => {
  const mathLines = mathInput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // editIdx === mathLines.length bedeutet: neue Aufgabe wird gerade angelegt.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const startEdit = (i: number) => {
    setEditIdx(i);
    setDraft(mathLines[i] ?? '');
  };

  const commitEdit = () => {
    if (editIdx === null) return;
    const wasAppending = editIdx >= mathLines.length;
    const lines = [...mathLines];
    const v = draft.trim();
    if (wasAppending) {
      if (v) lines.push(v);
    } else if (v) {
      lines[editIdx] = v;
    } else {
      lines.splice(editIdx, 1);
    }
    onChangeLines(lines);
    setDraft('');
    // Fortlaufendes Eintippen: nach dem Anhängen bleibt das Feld für die
    // nächste Aufgabe offen (Enter -> direkt weiter tippen), damit man nicht
    // für jede einzelne Aufgabe erneut auf "Aufgabe hinzufügen" klicken muss.
    // Leere Eingabe (Enter oder Verlassen) beendet das Hinzufügen.
    setEditIdx(wasAppending && v ? lines.length : null);
  };

  const rerollRow = (i: number) => {
    const lines = [...mathLines];
    lines[i] = generateSingleLine();
    onChangeLines(lines);
  };

  const deleteRow = (i: number) => {
    const lines = [...mathLines];
    lines.splice(i, 1);
    onChangeLines(lines);
    if (editIdx !== null) setEditIdx(null);
  };

  const reorderRows = (fromIdx: number, toIdx: number) => {
    onChangeLines(moveArrayItem(mathLines, fromIdx, toIdx));
    if (editIdx !== null) setEditIdx(null);
  };

  const rowActionBtn = (title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-line/60 transition-colors cursor-pointer shrink-0"
    >
      {children}
    </button>
  );

  return (
    <div className="border border-line rounded-[22px] p-4 flex flex-col gap-2.5 min-h-[11rem] lg:min-h-0 overflow-hidden">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted shrink-0">
        {validCount} Aufgaben
      </span>
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
        {mathLines.length === 0 && editIdx === null ? (
          <EmptyChips text="Noch keine Aufgaben." sub="Oben erzeugen oder unten selbst hinzufügen." />
        ) : (
          mathLines.map((line, i) => {
            const expr = parseMathExpr(line);
            // Fällt bei ungültigem einfachen Format auf die LaTeX-Auswertung
            // zurück (Brüche/Potenzen/Wurzeln, siehe latexMath.ts).
            const latexValue = expr ? null : evaluateLatexExpr(line);
            if (editIdx === i) {
              return (
                <input
                  key={`edit-${i}`}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditIdx(null);
                  }}
                  className="bg-surface-2 rounded-[10px] px-3.5 py-2.5 font-mono text-[13.5px] font-bold text-ink outline-none ring-2 ring-accent"
                  placeholder="z. B. 4 + 4"
                />
              );
            }
            return (
              <div
                key={`${line}-${i}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(i));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={() => setDragOverIdx((cur) => (cur === i ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIdx(null);
                  const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                  if (!Number.isNaN(fromIdx)) reorderRows(fromIdx, i);
                }}
                onDragEnd={() => setDragOverIdx(null)}
                className={`flex items-center justify-between gap-2 bg-surface-2 rounded-[10px] pl-3.5 pr-1.5 py-1.5 cursor-grab active:cursor-grabbing transition-shadow ${
                  dragOverIdx === i ? 'ring-2 ring-accent' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  title="Zum Bearbeiten klicken"
                  className={`font-mono text-[13.5px] font-bold text-left cursor-text rounded px-1 -mx-1 hover:bg-line/40 transition-colors ${expr || latexValue !== null ? 'text-ink' : 'text-danger'}`}
                >
                  {expr ? (
                    `${displayNum(expr.a)} ${opSymbol(expr.op)} ${displayNum(expr.b)} = ${displayNum(expr.result)}`
                  ) : latexValue !== null ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MathDisplay text={line} isLatex /> <span>= {displayNum(latexValue)}</span>
                    </span>
                  ) : (
                    `${line} (ungültig)`
                  )}
                </button>
                <div className="flex items-center">
                  {rowActionBtn('Neu würfeln', () => rerollRow(i), <RefreshCw className="w-3.5 h-3.5" />)}
                  {rowActionBtn('Löschen', () => deleteRow(i), <X className="w-4 h-4" />)}
                </div>
              </div>
            );
          })
        )}
        {editIdx === mathLines.length && (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditIdx(null);
            }}
            className="bg-surface-2 rounded-[10px] px-3.5 py-2.5 font-mono text-[13.5px] font-bold text-ink outline-none ring-2 ring-accent"
            placeholder="z. B. 4 + 4"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setEditIdx(mathLines.length);
          setDraft('');
        }}
        className="flex items-center justify-center gap-1.5 text-xs font-bold text-ink-faint hover:text-ink transition-colors w-full border-t border-line pt-2.5 mt-auto cursor-pointer shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Aufgabe hinzufügen (+ − · :)</span>
      </button>
    </div>
  );
};
