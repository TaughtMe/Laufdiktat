import React from 'react';
import { Upload, Calculator, Trash2, Sparkles } from 'lucide-react';
import type { useManualHighlighting } from '../../hooks/dashboard/useManualHighlighting';
import type { useMathImport } from '../../hooks/dashboard/useMathImport';
import type { WordItem } from '../../types/game';
import type { GapSlot } from '../../utils/dashboard/mathTasks';
import { NumberStepper } from '../shared/NumberStepper';

export type ImportMode = 'lines' | 'sentences' | 'manual' | 'math';

interface ImportStepProps {
  importMode: ImportMode;
  onImportModeChange: (mode: ImportMode) => void;
  manualInput: string;
  onManualInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  words: WordItem[];
  onResetChunks: () => void;
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

/**
 * Schritt 1 nach dem Redesign: angeheftete Reiter über einem Panel
 * (oben links bewusst eckig, damit der aktive erste Reiter bündig
 * anschließt), links die Eingabe je Modus, rechts die Abschnitts-Chips.
 */
export const ImportStep = ({
  importMode,
  onImportModeChange,
  manualInput,
  onManualInputChange,
  onFileUpload,
  words,
  onResetChunks,
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
  } = highlighting;

  const opToggle = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors cursor-pointer ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-transparent text-ink-muted border-line hover:text-ink'
      }`}
    >
      {label}
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
      <div className="bg-surface border border-line rounded-[0px_20px_20px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5 flex-1 min-h-0 p-5">
        {/* Linke Spalte: Eingabe je Modus */}
        {importMode === 'math' ? (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="bg-surface-2 rounded-[14px] p-4 space-y-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {opToggle('+ Plus', math.mathPlus, () => math.setMathPlus((v) => !v))}
                {opToggle('− Minus', math.mathMinus, () => math.setMathMinus((v) => !v))}
                {opToggle('· Mal', math.mathMul, () => math.setMathMul((v) => !v))}
                {opToggle(': Geteilt', math.mathDiv, () => math.setMathDiv((v) => !v))}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-bold text-ink">
                  <span>Bis</span>
                  <NumberStepper value={math.mathMax} onChange={math.setMathMax} min={1} max={1000} />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink">
                  <span>Anzahl</span>
                  <NumberStepper value={math.mathCount} onChange={math.setMathCount} min={1} max={50} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                <input type="checkbox" checked={math.mathNoNeg} onChange={(e) => math.setMathNoNeg(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                Keine negativen Ergebnisse
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                <input type="checkbox" checked={math.mathGap} onChange={(e) => math.setMathGap(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                Lückenaufgaben (fehlende Zahl, z. B. 4 + _ = 7)
              </label>
              <button
                type="button"
                onClick={math.handleGenerateMath}
                className="w-full py-2.5 bg-accent hover:opacity-90 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Calculator className="w-4 h-4" /> Aufgaben erzeugen
              </button>
            </div>
            <textarea
              value={math.mathInput}
              onChange={(e) => math.handleMathInputChange(e.target.value)}
              className="w-full flex-1 min-h-[6rem] p-3 bg-transparent text-ink font-mono leading-relaxed text-[15px] outline-none resize-none rounded-[14px]"
              placeholder={'4 + 4\n12 − 5\n7 + 8'}
            />
            {hint('Eine Aufgabe pro Zeile (+ − · :). Das Ergebnis wird automatisch berechnet.')}
          </div>
        ) : importMode === 'manual' ? (
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
                        onClick={() => handleDeleteChunk(seg.chunkId!)}
                        className="inline-block bg-accent-soft text-accent-strong rounded-lg px-2 py-0.5 mx-0.5 font-bold cursor-pointer hover:bg-danger/15 hover:text-danger transition-colors group relative"
                        title="Klicken zum Löschen"
                      >
                        {seg.text}
                        <span className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                          ×
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

        {/* Rechte Spalte: Abschnitte / Lücken-Auswahl */}
        <div className="bg-surface border border-line rounded-[22px] p-4 flex flex-col gap-2.5 min-h-[11rem] md:min-h-0 overflow-hidden">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted shrink-0">
            {words.length} Abschnitte
          </span>

          {importMode === 'math' && math.mathGap ? (
            math.mathExprs.length === 0 ? (
              <EmptyChips text="Keine Aufgaben" sub="Aufgaben links eingeben oder erzeugen." />
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                <p className="text-[11px] text-ink-muted mb-1">Tippe die Zahl an, die zur Lücke (_) werden soll:</p>
                {math.mathExprs.map((e, i) => {
                  const gap = math.mathGaps[i] ?? 'b';
                  const opSym = e.op === '+' ? '+' : e.op === '-' ? '−' : e.op === '*' ? '·' : ':';
                  const numBtn = (slot: GapSlot, val: number) => (
                    <button
                      type="button"
                      onClick={() => math.setGapAt(i, slot)}
                      className={`min-w-[2rem] px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                        gap === slot
                          ? 'bg-warn text-white'
                          : 'bg-surface-2 text-ink hover:bg-line'
                      }`}
                    >
                      {gap === slot ? '_' : val}
                    </button>
                  );
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-sm font-mono">
                      <span className="opacity-55 text-xs w-5 shrink-0 text-ink-muted">{i + 1}.</span>
                      {numBtn('a', e.a)}
                      <span className="text-ink-muted">{opSym}</span>
                      {numBtn('b', e.b)}
                      <span className="text-ink-muted">=</span>
                      {numBtn('result', e.result)}
                    </div>
                  );
                })}
              </div>
            )
          ) : words.length === 0 ? (
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
                    className="inline-flex items-center gap-1.5 bg-accent-soft text-accent-strong px-3 py-2 rounded-[10px] text-[13px] font-bold h-fit"
                  >
                    <span className="opacity-55 text-[11px]">{idx + 1}.</span>
                    <span className="break-all">{word.prompt ? `${word.prompt} = ${word.targetWord}` : word.targetWord}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteChunk(word.id)}
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
