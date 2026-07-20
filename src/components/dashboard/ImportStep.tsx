import React from 'react';
import { Upload } from 'lucide-react';
import type { useMathImport } from '../../hooks/dashboard/useMathImport';
import type { ManualRange, TextSection, TextSplitConfig } from '../../utils/dashboard/textSections';
import { generateMathLines } from '../../utils/dashboard/mathTasks';
import { MathQuickBar } from './MathQuickBar';
import { MathTaskList } from './MathTaskList';
import { MathSettingsPanel } from './MathSettingsPanel';
import { TextImportPanel } from './TextImportPanel';

export type ImportMode = 'text' | 'math';

interface ImportStepProps {
  importMode: ImportMode;
  onImportModeChange: (mode: ImportMode) => void;
  rawText: string;
  onRawTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearText: () => void;
  splitConfig: TextSplitConfig;
  onSplitConfigChange: (config: TextSplitConfig) => void;
  /** Alle Abschnitte mit Positionen (ohne Ausschluss/Sortierung). */
  sections: TextSection[];
  /** Anzahl der Abschnitte, die tatsächlich im Laufdiktat landen. */
  sectionCount: number;
  manualRanges: ManualRange[];
  manualResetNotice: boolean;
  canUndoManual: boolean;
  onAddSection: (start: number, end: number) => void;
  onRemoveManualSection: (section: TextSection) => void;
  onUndoManual: () => void;
  onClearManual: () => void;
  onOpenSectionManager: () => void;
  /** Komplette Rückgabe von useMathImport – reine Durchreichung. */
  math: ReturnType<typeof useMathImport>;
}

const TABS: Array<{ id: ImportMode; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'math', label: 'Mathe' },
];

/**
 * Schritt 1: zwei Reiter (Text / Mathe).
 *
 * Der Text-Reiter ist einspaltig – Eingabe und Abschnittsvorschau sind in einem
 * gemeinsamen Editor zusammengeführt (siehe TextImportPanel). Der Mathe-Zweig
 * ist funktional unverändert.
 */
export const ImportStep = ({
  importMode,
  onImportModeChange,
  rawText,
  onRawTextChange,
  onFileUpload,
  onClearText,
  splitConfig,
  onSplitConfigChange,
  sections,
  sectionCount,
  manualRanges,
  manualResetNotice,
  canUndoManual,
  onAddSection,
  onRemoveManualSection,
  onUndoManual,
  onClearManual,
  onOpenSectionManager,
  math,
}: ImportStepProps) => (
  <div className="flex h-full min-h-[600px] flex-col">
    {/* Reiter-Zeile + Upload-Pill */}
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-end gap-1 overflow-x-auto [scrollbar-width:none]">
        {TABS.map((tab) => {
          const active = importMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onImportModeChange(tab.id)}
              className={`relative shrink-0 cursor-pointer whitespace-nowrap rounded-t-[14px] px-7 pb-[17px] pt-[19px] text-[14.5px] leading-none transition-colors ${
                active
                  ? 'z-[2] bg-surface font-extrabold text-ink'
                  : 'z-[1] bg-surface-2 font-semibold text-ink-faint hover:text-ink-muted'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {importMode === 'text' && (
        <label
          className="mb-2 flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full
            border border-line bg-surface px-4 py-2.5 text-[12.5px] font-bold text-ink-muted
            transition-colors hover:bg-surface-2"
        >
          <Upload className="h-[15px] w-[15px]" />
          <span>Dokument hochladen</span>
          <input type="file" accept=".csv, .txt" onChange={onFileUpload} className="sr-only" />
        </label>
      )}
    </div>

    {/* Panel: oben links eckig (schließt an den ersten Reiter an) */}
    <div
      className={`min-h-0 flex-1 rounded-[0px_20px_20px_20px] border border-line bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        importMode === 'math' ? 'flex flex-col gap-4' : 'flex flex-col'
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
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
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
        <TextImportPanel
          rawText={rawText}
          onRawTextChange={onRawTextChange}
          onClearText={onClearText}
          sections={sections}
          sectionCount={sectionCount}
          splitConfig={splitConfig}
          onSplitConfigChange={onSplitConfigChange}
          manualRanges={manualRanges}
          manualResetNotice={manualResetNotice}
          canUndoManual={canUndoManual}
          onAddSection={onAddSection}
          onRemoveManualSection={onRemoveManualSection}
          onUndoManual={onUndoManual}
          onClearManual={onClearManual}
          onOpenSectionManager={onOpenSectionManager}
        />
      )}
    </div>
  </div>
);
