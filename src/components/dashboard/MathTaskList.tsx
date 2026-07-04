import { useCallback, useRef, useState } from 'react';
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

interface ToolbarItem {
  label: string;
  title: string;
  insert: string;
  /** Cursor-Position relativ zum Einfügestart, nach dem Einfügen (z. B. mitten in \frac{}{}). */
  cursorOffset: number;
}

// Symbole zum direkten Einfügen an der Cursorposition während des
// Bearbeitens einer Aufgabenzeile (siehe latexMath.ts für die unterstützte
// Syntax: \frac{}{}, \sqrt{}, ^, Klammern).
const TOOLBAR_ITEMS: ToolbarItem[] = [
  { label: '+', title: 'Plus', insert: ' + ', cursorOffset: 3 },
  { label: '−', title: 'Minus', insert: ' − ', cursorOffset: 3 },
  { label: '·', title: 'Mal', insert: ' · ', cursorOffset: 3 },
  { label: ':', title: 'Geteilt', insert: ' : ', cursorOffset: 3 },
  { label: '( )', title: 'Klammer', insert: '()', cursorOffset: 1 },
  { label: 'xʸ', title: 'Potenz', insert: '^', cursorOffset: 1 },
  { label: '√', title: 'Wurzel', insert: '\\sqrt{}', cursorOffset: 6 },
  { label: 'a/b', title: 'Bruch', insert: '\\frac{}{}', cursorOffset: 6 },
];

/**
 * "Aufgabenliste": Zeilen einzeln bearbeiten/würfeln/löschen, per Drag & Drop
 * umsortieren, fortlaufend neue Aufgaben eintippen. Im Bearbeiten-Modus
 * (neue Zeile anhängen ODER bestehende Zeile bearbeiten) erscheinen darunter
 * eine Symbolleiste zum Einfügen von Operatoren/Bruch/Potenz/Wurzel an der
 * Cursorposition sowie eine live berechnete Ergebnis-Vorschau. Tab/Enter
 * committen die Zeile und machen (beim Anhängen) mit einem leeren Feld
 * weiter; Verlassen des Feldes (Blur) committet und beendet das Bearbeiten.
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
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (i: number) => {
    setEditIdx(i);
    setDraft(mathLines[i] ?? '');
  };

  // continueEditing=false (Blur): committen und Bearbeiten komplett beenden
  // (Button "Aufgabe hinzufügen" erscheint wieder). continueEditing=true
  // (Enter/Tab): committen und beim Anhängen direkt mit einem neuen leeren
  // Feld weitermachen (fortlaufendes Eintippen). Leere Eingabe beendet in
  // beiden Fällen.
  const commitEdit = (continueEditing: boolean) => {
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
    setEditIdx(continueEditing && wasAppending && v ? lines.length : null);
  };

  const insertAtCursor = useCallback((item: ToolbarItem) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? start;
    setDraft((prev) => prev.slice(0, start) + item.insert + prev.slice(end));
    const pos = start + item.cursorOffset;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }, [setDraft]);

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

  // Live-Vorschau während des Tippens: einfaches Format zuerst, sonst
  // LaTeX-Fallback (siehe auch die Zeilen-Anzeige weiter unten).
  const draftExpr = parseMathExpr(draft);
  const draftLatexValue = draftExpr ? null : evaluateLatexExpr(draft);
  const draftResult = draftExpr
    ? displayNum(draftExpr.result)
    : draftLatexValue !== null
    ? displayNum(draftLatexValue)
    : null;

  const renderEditField = (key: string) => (
    <div key={key} className="flex flex-col gap-1.5 bg-surface-2 rounded-[10px] p-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitEdit(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              commitEdit(true);
            }
            if (e.key === 'Escape') {
              setDraft('');
              setEditIdx(null);
            }
          }}
          className="flex-1 min-w-0 bg-surface rounded-lg px-3.5 py-2.5 font-mono text-[13.5px] font-bold text-ink outline-none ring-2 ring-accent"
          placeholder="z. B. 4 + 4"
        />
        {draft.trim() !== '' && (
          <span
            className={`text-[12px] font-bold shrink-0 whitespace-nowrap ${
              draftResult !== null ? 'text-ink-muted' : 'text-danger'
            }`}
          >
            {draftResult !== null ? `= ${draftResult}` : 'ungültig'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.title}
            // Verhindert, dass das Eingabefeld beim Klick auf den Button den
            // Fokus verliert (sonst würde Blur schon vor dem Einfügen feuern).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertAtCursor(item)}
            className="min-w-[1.75rem] h-7 px-1.5 rounded-md text-[13px] font-bold border border-line text-ink-muted hover:text-accent-strong hover:border-accent transition-colors cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
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
              return renderEditField(`edit-${i}`);
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
        {editIdx === mathLines.length && renderEditField('append')}
      </div>
      {editIdx !== mathLines.length && (
        <button
          type="button"
          onClick={() => {
            setEditIdx(mathLines.length);
            setDraft('');
          }}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-accent-strong hover:opacity-75 transition-opacity w-full border-t border-line pt-2.5 mt-auto cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Aufgabe hinzufügen</span>
        </button>
      )}
    </div>
  );
};
