import React, { useState } from 'react';
import { Upload, Trash2, X } from 'lucide-react';
import type { useManualHighlighting } from '../../hooks/dashboard/useManualHighlighting';
import type { useMathImport } from '../../hooks/dashboard/useMathImport';
import type { WordItem } from '../../types/game';
import { generateMathLines } from '../../utils/dashboard/mathTasks';
import { EmptyChips } from './EmptyChips';
import { MathQuickBar } from './MathQuickBar';
import { MathTaskList } from './MathTaskList';
import { MathSettingsPanel } from './MathSettingsPanel';

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

/**
 * Schritt 1 nach dem Redesign: angeheftete Reiter über einem Panel
 * (oben links bewusst eckig, damit der aktive erste Reiter bündig
 * anschließt). Sätze/Zeilen/Manuell: links Eingabe, rechts Abschnitts-
 * Chips. Mathe: MathQuickBar oben, darunter MathTaskList (links) und
 * MathSettingsPanel mit Vorschau (rechts, Einstellungen als Overlay über
 * der Vorschau via Zahnrad-Icon).
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
            <MathQuickBar
              mathPlus={math.mathPlus}
              setMathPlus={math.setMathPlus}
              mathMinus={math.mathMinus}
              setMathMinus={math.setMathMinus}
              mathMul={math.mathMul}
              setMathMul={math.setMathMul}
              mathDiv={math.mathDiv}
              setMathDiv={math.setMathDiv}
              mathMaxValue={math.mathMaxValue}
              setMathMaxValue={math.setMathMaxValue}
              mathCount={math.mathCount}
              setMathCount={math.setMathCount}
              onGenerate={math.handleGenerateMath}
            />

            {/* Stabil responsiv: Desktop nebeneinander, schmälere Tablets untereinander. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 flex-1 min-h-0">
              <MathTaskList
                mathInput={math.mathInput}
                validCount={math.mathExprs.length}
                onChangeLines={(lines) => math.handleMathInputChange(lines.join('\n'))}
                generateSingleLine={() => generateMathLines({ ...math.buildGenOptions(), count: 1 })[0]}
              />
              <MathSettingsPanel
                mathMinValue={math.mathMinValue}
                setMathMinValue={math.setMathMinValue}
                mathMaxValue={math.mathMaxValue}
                setMathMaxValue={math.setMathMaxValue}
                mathAllowNegative={math.mathAllowNegative}
                setMathAllowNegative={math.setMathAllowNegative}
                mathExcludeZeroOperand={math.mathExcludeZeroOperand}
                setMathExcludeZeroOperand={math.setMathExcludeZeroOperand}
                mathExcludeZeroResult={math.mathExcludeZeroResult}
                setMathExcludeZeroResult={math.setMathExcludeZeroResult}
                mathGap={math.mathGap}
                setMathGap={math.setMathGap}
                mathTables={math.mathTables}
                setMathTables={math.setMathTables}
                showMultiplicationTables={math.mathMul || math.mathDiv}
                mathExprs={math.mathExprs}
                mathGaps={math.mathGaps}
                setGapAt={math.setGapAt}
              />
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
