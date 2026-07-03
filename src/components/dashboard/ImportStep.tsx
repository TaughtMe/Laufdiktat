import React, { useState } from 'react';
import { Upload, Trash2, Sparkles, RefreshCw, X, Plus } from 'lucide-react';
import type { useManualHighlighting } from '../../hooks/dashboard/useManualHighlighting';
import type { useMathImport } from '../../hooks/dashboard/useMathImport';
import type { WordItem } from '../../types/game';
import { generateMathLines, parseMathExpr, type GapSlot, type MathOp } from '../../utils/dashboard/mathTasks';
import { moveArrayItem } from '../../utils/dashboard/reorder';
import { MiniStepper } from './MiniStepper';

export type ImportMode = 'lines' | 'sentences' | 'manual' | 'math';

interface ImportStepProps {
  importMode: ImportMode;
  onImportModeChange: (mode: ImportMode) => void;
  manualInput: string;
  onManualInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  words: WordItem[];
  onResetChunks: () => void;
  /** Löscht einen einzelnen Abschnitt (Panel-Chip), mode-abhängig. */
  onDeleteWord: (id: string) => void;
  /** Sortiert die Abschnitte per Drag & Drop um, mode-abhängig. */
  onReorderWords: (fromIndex: number, toIndex: number) => void;
  /** Komplette Rückgabe von useManualHighlighting – reine Durchreichung. */
  highlighting: ReturnType<typeof useManualHighlighting>;
  /** Komplette Rückgabe von useMathImport – reine Durchreichung. */
  math: ReturnType<typeof useMathImport>;
}

const TABS: Array<{ id: ImportMode; label: string }> = [
  { id: 'sentences', label: 'Sätze' },
  { id: 'lines', label: 'Zeilen' },
  { id: 'manual', label: 'Manuell' },
  { id: 'math', label: 'Mathe' },
];

const OP_SYM: Record<MathOp, string> = { '+': '+', '-': '−', '*': '·', '/': ':' };

/**
 * Schritt 1 nach dem Redesign: angeheftete Reiter über einem Panel
 * (oben links bewusst eckig, damit der aktive erste Reiter bündig
 * anschließt). Sätze/Zeilen/Manuell: links Eingabe, rechts Abschnitts-
 * Chips. Mathe: Generator-Toolbar oben, darunter Aufgabenliste mit
 * Zeilen-Aktionen (Bearbeiten/Neu würfeln/Löschen) und Vorschau-Panel.
 */
export const ImportStep = ({
  importMode,
  onImportModeChange,
  manualInput,
  onManualInputChange,
  onFileUpload,
  words,
  onResetChunks,
  onDeleteWord,
  onReorderWords,
  highlighting,
  math,
}: ImportStepProps) => {
  const {
    highlightContainerRef,
    getSegments,
    tokenizeText,
    handleWordClick,
    handleMouseUp,
    handleDeleteChunk,
    moveChunk,
  } = highlighting;

  // Drag & Drop: Index/Chunk, über dem gerade gezogen wird (nur fürs
  // visuelle Feedback, der eigentliche Reorder passiert erst beim Drop).
  const [dragOverWordIdx, setDragOverWordIdx] = useState<number | null>(null);
  const [dragOverChunkId, setDragOverChunkId] = useState<string | null>(null);
  const [dragOverMathIdx, setDragOverMathIdx] = useState<number | null>(null);

  // --- Mathe: zeilenbasierte Aufgabenliste (mathInput bleibt die Quelle) ---
  const mathLines = math.mathInput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  // editIdx === mathLines.length bedeutet: neue Aufgabe wird gerade angelegt.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const commitLines = (lines: string[]) => math.handleMathInputChange(lines.join('\n'));

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
    commitLines(lines);
    setDraft('');
    // Fortlaufendes Eintippen: nach dem Anhängen bleibt das Feld für die
    // nächste Aufgabe offen (Enter -> direkt weiter tippen), damit man nicht
    // für jede einzelne Aufgabe erneut auf "Aufgabe hinzufügen" klicken muss.
    // Leere Eingabe (Enter oder Verlassen) beendet das Hinzufügen.
    setEditIdx(wasAppending && v ? lines.length : null);
  };

  const currentOps = (): MathOp[] => {
    const ops: MathOp[] = [];
    if (math.mathPlus) ops.push('+');
    if (math.mathMinus) ops.push('-');
    if (math.mathMul) ops.push('*');
    if (math.mathDiv) ops.push('/');
    return ops.length ? ops : ['+'];
  };

  const rerollRow = (i: number) => {
    const [line] = generateMathLines({ ops: currentOps(), max: math.mathMax, count: 1, noNegative: math.mathNoNeg });
    const lines = [...mathLines];
    lines[i] = line;
    commitLines(lines);
  };

  const deleteRow = (i: number) => {
    const lines = [...mathLines];
    lines.splice(i, 1);
    commitLines(lines);
    if (editIdx !== null) setEditIdx(null);
  };

  const reorderRows = (fromIdx: number, toIdx: number) => {
    commitLines(moveArrayItem(mathLines, fromIdx, toIdx));
    if (editIdx !== null) setEditIdx(null);
  };

  const opPill = (label: string, title: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`w-9 h-9 rounded-lg text-[15px] font-extrabold border transition-colors cursor-pointer ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-transparent text-ink-muted border-line hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

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

  const hint = (text: string) => (
    <p className="text-[11.5px] text-ink-faint mt-2 leading-relaxed shrink-0">{text}</p>
  );

  return (
    <div className="flex flex-col h-full min-h-[460px]">
      {/* Reiter-Zeile + Upload-Pill */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex gap-1 items-end overflow-x-auto min-w-0 [scrollbar-width:none]">
          {TABS.map((tab) => {
            const active = importMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onImportModeChange(tab.id)}
                className={`rounded-t-[14px] px-7 pt-[19px] pb-[17px] text-[14.5px] leading-none whitespace-nowrap shrink-0 cursor-pointer relative transition-colors ${
                  active
                    ? 'bg-surface text-ink font-extrabold z-[2]'
                    : 'bg-surface-2 text-ink-faint font-semibold z-[1] hover:text-ink-muted'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 px-4 py-2.5 mb-2 rounded-full border border-line bg-surface text-ink-muted text-[12.5px] font-bold cursor-pointer whitespace-nowrap shrink-0 hover:bg-surface-2 transition-colors">
          <Upload className="w-[15px] h-[15px]" />
          <span>Dokument hochladen</span>
          <input type="file" accept=".csv, .txt" onChange={onFileUpload} className="sr-only" />
        </label>
      </div>

      {/* Panel: oben links eckig (schließt an den ersten Reiter an) */}
      <div
        className={`bg-surface border border-line rounded-[0px_20px_20px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex-1 min-h-0 p-5 ${
          importMode === 'math' ? 'flex flex-col gap-4' : 'grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5'
        }`}
      >
        {importMode === 'math' ? (
          <>
            {/* Generator-Toolbar */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 shrink-0">
              <div className="flex items-center gap-1.5">
                {opPill('+', 'Plus-Aufgaben', math.mathPlus, () => math.setMathPlus((v) => !v))}
                {opPill('−', 'Minus-Aufgaben', math.mathMinus, () => math.setMathMinus((v) => !v))}
                {opPill('·', 'Mal-Aufgaben', math.mathMul, () => math.setMathMul((v) => !v))}
                {opPill(':', 'Geteilt-Aufgaben', math.mathDiv, () => math.setMathDiv((v) => !v))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-ink">Bis:</span>
                <MiniStepper value={math.mathMax} onChange={math.setMathMax} min={1} max={1000} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-ink">Anzahl:</span>
                <MiniStepper value={math.mathCount} onChange={math.setMathCount} min={1} max={50} />
              </div>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={math.mathNoNeg}
                  onChange={(e) => math.setMathNoNeg(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[var(--accent)]"
                />
                Keine negativen Ergebnisse
              </label>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={math.mathGap}
                  onChange={(e) => math.setMathGap(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[var(--accent)]"
                />
                Lückenaufgaben (fehlende Zahl, z.&nbsp;B. 4 + __ = 7)
              </label>
              <button
                type="button"
                onClick={math.handleGenerateMath}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-accent hover:opacity-90 text-white rounded-full font-bold text-[13px] transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" /> Aufgaben erzeugen
              </button>
            </div>

            {/* Aufgabenliste + Vorschau */}
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5 flex-1 min-h-0">
              {/* Linke Karte: Aufgaben mit Zeilen-Aktionen */}
              <div className="border border-line rounded-[22px] p-4 flex flex-col gap-2.5 min-h-[11rem] md:min-h-0 overflow-hidden">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted shrink-0">
                  {math.mathExprs.length} Aufgaben
                </span>
                <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                  {mathLines.length === 0 && editIdx === null ? (
                    <EmptyChips text="Noch keine Aufgaben." sub="Oben erzeugen oder unten selbst hinzufügen." />
                  ) : (
                    mathLines.map((line, i) => {
                      const expr = parseMathExpr(line);
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
                          onDragOver={(e) => { e.preventDefault(); setDragOverMathIdx(i); }}
                          onDragLeave={() => setDragOverMathIdx((cur) => (cur === i ? null : cur))}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverMathIdx(null);
                            const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                            if (!Number.isNaN(fromIdx)) reorderRows(fromIdx, i);
                          }}
                          onDragEnd={() => setDragOverMathIdx(null)}
                          className={`flex items-center justify-between gap-2 bg-surface-2 rounded-[10px] pl-3.5 pr-1.5 py-1.5 cursor-grab active:cursor-grabbing transition-shadow ${
                            dragOverMathIdx === i ? 'ring-2 ring-accent' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            title="Zum Bearbeiten klicken"
                            className={`font-mono text-[13.5px] font-bold text-left cursor-text rounded px-1 -mx-1 hover:bg-line/40 transition-colors ${expr ? 'text-ink' : 'text-danger'}`}
                          >
                            {expr ? `${expr.a} ${OP_SYM[expr.op]} ${expr.b} = ${expr.result}` : `${line} (ungültig)`}
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

              {/* Rechte Karte: Vorschau (bei Lücken interaktiv) */}
              <div className="border border-line rounded-[22px] p-4 flex flex-col gap-2.5 min-h-[11rem] md:min-h-0 overflow-hidden">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted shrink-0">
                  {math.mathGap ? 'Vorschau (Lücken)' : 'Vorschau'}
                </span>
                {math.mathExprs.length === 0 ? (
                  <EmptyChips text="Noch keine Aufgaben." sub="Die Vorschau erscheint, sobald Aufgaben da sind." />
                ) : math.mathGap ? (
                  <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                    <p className="text-[11px] text-ink-muted mb-1">Tippe die Zahl an, die zur Lücke (_) werden soll:</p>
                    {math.mathExprs.map((e, i) => {
                      const gap = math.mathGaps[i] ?? 'b';
                      const numBtn = (slot: GapSlot, val: number) => (
                        <button
                          type="button"
                          onClick={() => math.setGapAt(i, slot)}
                          className={`min-w-[2rem] px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                            gap === slot ? 'bg-warn text-white' : 'bg-surface-2 text-ink hover:bg-line'
                          }`}
                        >
                          {gap === slot ? '_' : val}
                        </button>
                      );
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-sm font-mono">
                          <span className="opacity-55 text-xs w-5 shrink-0 text-ink-muted">{i + 1}.</span>
                          {numBtn('a', e.a)}
                          <span className="text-ink-muted">{OP_SYM[e.op]}</span>
                          {numBtn('b', e.b)}
                          <span className="text-ink-muted">=</span>
                          {numBtn('result', e.result)}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                    {math.mathExprs.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-[13.5px] font-mono">
                        <span className="text-ink-faint text-xs w-6 shrink-0 text-right">{i + 1}.</span>
                        <span className="font-bold text-ink">{`${e.a} ${OP_SYM[e.op]} ${e.b} = ${e.result}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Linke Spalte: Eingabe je Modus */}
            {importMode === 'manual' ? (
              manualInput.trim() === '' ? (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-surface-2 border border-dashed border-line rounded-[14px] min-h-[11rem]">
                  <span className="text-3xl mb-2">✍️</span>
                  <p className="text-sm font-bold text-ink">Kein Text vorhanden</p>
                  <p className="text-xs text-ink-faint mt-1 max-w-[280px]">
                    Wechsle zu Sätze oder Zeilen, um Text einzugeben, bevor du markierst.
                  </p>
                  <button
                    type="button"
                    onClick={() => onImportModeChange('sentences')}
                    className="mt-3 px-3 py-1.5 bg-accent-soft text-accent-strong rounded-lg text-xs font-bold hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    Modus wechseln
                  </button>
                </div>
              ) : (
                <div className="flex flex-col min-h-0">
                  <div
                    ref={highlightContainerRef}
                    onMouseUp={handleMouseUp}
                    className="w-full flex-1 min-h-[11rem] overflow-y-auto p-4 text-ink leading-relaxed text-[15px] select-text break-words whitespace-pre-wrap rounded-[14px]"
                  >
                    {getSegments().map((seg, idx) => {
                      if (seg.isHighlighted) {
                        return (
                          <span
                            key={seg.chunkId}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', seg.chunkId!);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverChunkId(seg.chunkId!); }}
                            onDragLeave={() => setDragOverChunkId((cur) => (cur === seg.chunkId ? null : cur))}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverChunkId(null);
                              const fromId = e.dataTransfer.getData('text/plain');
                              if (fromId) moveChunk(fromId, seg.chunkId!);
                            }}
                            onDragEnd={() => setDragOverChunkId(null)}
                            onClick={() => handleDeleteChunk(seg.chunkId!)}
                            className={`inline-block bg-accent-soft text-accent-strong rounded-lg px-2 py-0.5 mx-0.5 font-bold cursor-grab active:cursor-grabbing hover:bg-danger/15 hover:text-danger transition-colors group relative ${
                              dragOverChunkId === seg.chunkId ? 'ring-2 ring-accent-strong' : ''
                            }`}
                            title="Ziehen zum Verschieben, Klicken zum Löschen"
                          >
                            {seg.text}
                            {/* SVG statt Text-"×": ein echtes Zeichen hier würde die
                                Zeichen-Indizes verfälschen, die handleMouseUp per
                                Selection-Range aus dem gerenderten Text berechnet. */}
                            <span className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                              <X className="w-2.5 h-2.5" />
                            </span>
                          </span>
                        );
                      }
                      return (
                        <React.Fragment key={idx}>
                          {tokenizeText(seg.text, seg.start).map((tok, tIdx) =>
                            tok.isWord ? (
                              <span
                                key={tIdx}
                                onClick={() => handleWordClick(tok.start, tok.end, tok.text)}
                                className="cursor-pointer hover:bg-surface-2 px-0.5 rounded transition-colors duration-100 text-ink"
                              >
                                {tok.text}
                              </span>
                            ) : (
                              <span key={tIdx} className="text-ink">{tok.text}</span>
                            )
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {hint('Klicke auf Wörter, um sie zu Abschnitten zu verbinden.')}
                </div>
              )
            ) : (
              <div className="flex flex-col min-h-0">
                <textarea
                  value={manualInput}
                  onChange={onManualInputChange}
                  className="w-full flex-1 min-h-[11rem] p-3 bg-transparent text-ink leading-[1.7] text-[15px] outline-none resize-none rounded-[14px]"
                  placeholder={
                    importMode === 'sentences'
                      ? 'Der schnelle Fuchs springt über den Zaun. Der Igel schläft im Laub.'
                      : 'Elefant\nGiraffe\nNashorn'
                  }
                />
                {hint(
                  importMode === 'sentences'
                    ? 'Der Text wird automatisch bei Satzzeichen (. ! ?) in Abschnitte aufgeteilt.'
                    : 'Jede Zeile wird ein eigener Abschnitt (optional mit Semikolon für Hinweise: Wort;Hinweis).'
                )}
              </div>
            )}

            {/* Rechte Spalte: Abschnitte */}
            <div className="bg-surface border border-line rounded-[22px] p-4 flex flex-col gap-2.5 min-h-[11rem] md:min-h-0 overflow-hidden">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted shrink-0">
                {words.length} Abschnitte
              </span>

              {words.length === 0 ? (
                <EmptyChips
                  text="Noch keine Abschnitte."
                  sub={importMode === 'manual' ? 'Klicke auf Wörter im Textfeld links.' : 'Gib Text im linken Feld ein.'}
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 content-start overflow-y-auto flex-1 min-h-0">
                    {words.map((word, idx) => (
                      <div
                        key={word.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverWordIdx(idx); }}
                        onDragLeave={() => setDragOverWordIdx((cur) => (cur === idx ? null : cur))}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverWordIdx(null);
                          const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                          if (!Number.isNaN(fromIdx)) onReorderWords(fromIdx, idx);
                        }}
                        onDragEnd={() => setDragOverWordIdx(null)}
                        className={`inline-flex items-center gap-1.5 bg-accent-soft text-accent-strong px-3 py-2 rounded-[10px] text-[13px] font-bold h-fit cursor-grab active:cursor-grabbing transition-shadow ${
                          dragOverWordIdx === idx ? 'ring-2 ring-accent-strong' : ''
                        }`}
                      >
                        <span className="opacity-55 text-[11px]">{idx + 1}.</span>
                        <span className="break-all">{word.prompt ? `${word.prompt} = ${word.targetWord}` : word.targetWord}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteWord(word.id)}
                          className="text-[13px] leading-none cursor-pointer hover:opacity-70 ml-0.5"
                          title="Abschnitt löschen"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onResetChunks}
                    className="flex items-center justify-center gap-2 text-xs font-bold text-ink-faint hover:text-danger transition-colors w-full border-t border-line pt-2.5 mt-auto cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Alle löschen</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const EmptyChips = ({ text, sub }: { text: string; sub: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-ink-faint">
    <Sparkles className="w-7 h-7 mb-2 opacity-50" />
    <p className="text-xs font-bold">{text}</p>
    <p className="text-[10px] mt-0.5">{sub}</p>
  </div>
);
