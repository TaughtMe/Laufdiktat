import React from 'react';
import { Upload } from 'lucide-react';
import type { useMathImport } from '../../hooks/dashboard/useMathImport';
import type { WordItem } from '../../types/game';
import type { TextSplitConfig } from '../../utils/dashboard/textSections';
import { generateMathLines } from '../../utils/dashboard/mathTasks';
import { EmptyChips } from './EmptyChips';
import { MathQuickBar } from './MathQuickBar';
import { MathTaskList } from './MathTaskList';
import { MathSettingsPanel } from './MathSettingsPanel';
import { TextSplitControls } from './TextSplitControls';

export type ImportMode = 'text' | 'math';

interface ImportStepProps {
  importMode: ImportMode;
  onImportModeChange: (mode: ImportMode) => void;
  rawText: string;
  onRawTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  splitConfig: TextSplitConfig;
  onSplitConfigChange: (config: TextSplitConfig) => void;
  words: WordItem[];
  /** Komplette Rückgabe von useMathImport – reine Durchreichung. */
  math: ReturnType<typeof useMathImport>;
}

const TABS: Array<{ id: ImportMode; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'math', label: 'Mathe' },
];

/**
 * Schritt 1: zwei Reiter (Text / Mathe). Im Text-Reiter links der Rohtext
 * (einzige Quelle), rechts die Trennregeln (Schnellwahl, Chips, Zeilenmodus,
 * benutzerdefinierte Trenner) und darunter die Live-Vorschau der Abschnitte.
 * Die Aufteilung selbst macht buildTextSections (siehe Dashboard.tsx).
 * Mathe-Zweig unverändert.
 */
export const ImportStep = ({
  importMode,
  onImportModeChange,
  rawText,
  onRawTextChange,
  onFileUpload,
  splitConfig,
  onSplitConfigChange,
  words,
  math,
}: ImportStepProps) => {
  return (
    <div className="flex flex-col h-full min-h-[600px]">
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
        {importMode === 'text' && (
          <label className="flex items-center gap-2 px-4 py-2.5 mb-2 rounded-full border border-line bg-surface text-ink-muted text-[12.5px] font-bold cursor-pointer whitespace-nowrap shrink-0 hover:bg-surface-2 transition-colors">
            <Upload className="w-[15px] h-[15px]" />
            <span>Dokument hochladen</span>
            <input type="file" accept=".csv, .txt" onChange={onFileUpload} className="sr-only" />
          </label>
        )}
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
                validCount={math.mathPreviewLines.length}
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
                mathPreviewLines={math.mathPreviewLines}
                mathGaps={math.mathGaps}
                setGapAt={math.setGapAt}
              />
            </div>
          </>
        ) : (
          <>
            {/* Linke Spalte: Rohtext (einzige Quelle) */}
            <div className="flex flex-col min-h-0">
              <textarea
                value={rawText}
                onChange={onRawTextChange}
                className="w-full flex-1 min-h-[11rem] p-3 bg-transparent text-ink leading-[1.7] text-[15px] outline-none resize-none rounded-[14px]"
                placeholder={'Der schnelle Fuchs springt über den Zaun. Der Igel schläft im Laub.'}
              />
              <p className="text-[11.5px] text-ink-faint mt-2 leading-relaxed shrink-0">
                Text einmal eingeben oder hochladen – die Aufteilung steuerst du rechts.
              </p>
            </div>

            {/* Rechte Spalte: Trennregeln + Live-Vorschau */}
            <div className="flex flex-col gap-5 min-h-0 overflow-y-auto">
              <TextSplitControls config={splitConfig} onChange={onSplitConfigChange} />

              <div className="bg-surface-2 border border-line rounded-[16px] p-4 flex flex-col gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted shrink-0">
                  {words.length} Abschnitte
                </span>
                {words.length === 0 ? (
                  <EmptyChips text="Noch keine Abschnitte." sub="Gib Text im linken Feld ein." />
                ) : (
                  <div className="flex flex-wrap gap-2 content-start">
                    {words.map((word, idx) => (
                      <div
                        key={word.id}
                        className="inline-flex items-center gap-1.5 bg-accent-soft text-accent-strong px-3 py-2 rounded-[10px] text-[13px] font-bold h-fit"
                      >
                        <span className="opacity-55 text-[11px]">{idx + 1}.</span>
                        <span className="break-all">{word.targetWord}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
