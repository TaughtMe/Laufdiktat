import React, { useState } from 'react';
import { Highlighter, ListOrdered, RotateCcw, Undo2 } from 'lucide-react';
import type { ManualRange, TextSection, TextSplitConfig } from '../../utils/dashboard/textSections';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CharacterSplitPanel } from './CharacterSplitPanel';
import { EditorFrame } from './editorFrame';
import { NewlineSplitPanel } from './NewlineSplitPanel';
import { SplitRuleToggle } from './SplitRuleToggle';
import { TextMarkerEditor } from './TextMarkerEditor';
import { TextSegmentEditor } from './TextSegmentEditor';

/** Ab dieser Textlänge wird das Leeren vorher bestätigt. */
const CONFIRM_CLEAR_THRESHOLD = 200;

interface TextImportPanelProps {
  rawText: string;
  onRawTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onClearText: () => void;
  /** Alle Abschnitte mit Positionen (ohne Ausschluss/Sortierung) – für die Einfärbung. */
  sections: TextSection[];
  /** Anzahl der Abschnitte, die tatsächlich im Laufdiktat landen. */
  sectionCount: number;
  splitConfig: TextSplitConfig;
  onSplitConfigChange: (config: TextSplitConfig) => void;
  manualRanges: ManualRange[];
  manualResetNotice: boolean;
  canUndoManual: boolean;
  onAddSection: (start: number, end: number) => void;
  onRemoveManualSection: (section: TextSection) => void;
  onUndoManual: () => void;
  onClearManual: () => void;
  onOpenSectionManager: () => void;
}

/**
 * Der Reiter „Text": Kopfzeile mit Abschnittszähler und Verwaltung, die beiden
 * unabhängigen Regelschalter, der gemeinsame Editor und die Fußzeile.
 *
 * Es gibt bewusst KEINE zweite dauerhafte Vorschau – die Abschnitte sind direkt
 * im Editor sichtbar, alles Weitere liegt in der optionalen Verwaltung.
 */
export const TextImportPanel = ({
  rawText,
  onRawTextChange,
  onClearText,
  sections,
  sectionCount,
  splitConfig,
  onSplitConfigChange,
  manualRanges,
  manualResetNotice,
  canUndoManual,
  onAddSection,
  onRemoveManualSection,
  onUndoManual,
  onClearManual,
  onOpenSectionManager,
}: TextImportPanelProps) => {
  const [markerRequested, setMarkerRequested] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const hasText = rawText.trim().length > 0;
  // Ohne Text gibt es nichts zu markieren. Bewusst abgeleitet statt per Effekt
  // zurückgesetzt: der Marker soll nach erneuter Eingabe wieder aktiv sein.
  const isMarkerMode = markerRequested && hasText;

  const requestClear = () => {
    if (rawText.trim().length > CONFIRM_CLEAR_THRESHOLD) {
      setConfirmClear(true);
      return;
    }
    onClearText();
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Kopfzeile: Titel, Zähler, Verwaltung */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Text</span>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.02em] text-ink-muted">
            {sectionCount} {sectionCount === 1 ? 'Abschnitt' : 'Abschnitte'}
          </span>
          <button
            type="button"
            onClick={onOpenSectionManager}
            disabled={sections.length === 0}
            title="Abschnitte ausschließen oder umsortieren"
            className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-line
              px-3 text-[12px] font-bold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink
              disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ListOrdered className="h-3.5 w-3.5" />
            <span>Abschnitte verwalten</span>
          </button>
        </div>
      </div>

      {manualResetNotice && (
        <div
          role="status"
          className="shrink-0 rounded-[10px] bg-warn-soft px-3 py-2 text-[12px] font-semibold text-warn"
        >
          Der Text wurde verändert. Manuelle Anpassungen wurden zurückgesetzt.
        </div>
      )}

      {/* Regelzeile: Zeichen und Enter unabhängig, Marker rechts */}
      <div className="flex flex-wrap items-center gap-2">
        <SplitRuleToggle
          label="Zeichen"
          active={splitConfig.punctuationEnabled}
          onToggle={() =>
            onSplitConfigChange({ ...splitConfig, punctuationEnabled: !splitConfig.punctuationEnabled })
          }
        />

        <SplitRuleToggle
          label="Enter"
          active={splitConfig.newlineEnabled}
          onToggle={() =>
            onSplitConfigChange({ ...splitConfig, newlineEnabled: !splitConfig.newlineEnabled })
          }
        />

        <div className="flex-1" />

        <button
          type="button"
          disabled={!hasText}
          onClick={() => setMarkerRequested((m) => !m)}
          aria-pressed={isMarkerMode}
          className={`flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-[10px] border px-3.5
            text-[13px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isMarkerMode
                ? 'border-accent bg-accent text-white'
                : 'border-line text-ink-muted hover:text-ink'
            }`}
        >
          <Highlighter className="h-3.5 w-3.5 shrink-0" />
          <span>{isMarkerMode ? 'Marker aktiv' : 'Marker'}</span>
        </button>
      </div>

      {/* Einstellungsleiste: dauerhaft sichtbar, bei inaktiver Regel ausgegraut.
          Das <fieldset disabled> ist bewusst kein reines opacity/pointer-events:
          es deaktiviert die enthaltenen Bedienelemente nativ, nimmt sie also auch
          aus der Tabreihenfolge und meldet sie Screenreadern als inaktiv. */}
      <div className="flex flex-wrap items-stretch gap-2.5">
        <fieldset
          disabled={!splitConfig.punctuationEnabled}
          className="m-0 min-w-[17rem] flex-1 rounded-[12px] border border-line bg-surface-2 p-3
            transition-opacity disabled:opacity-40"
        >
          <CharacterSplitPanel config={splitConfig} onChange={onSplitConfigChange} />
        </fieldset>

        <fieldset
          disabled={!splitConfig.newlineEnabled}
          className="m-0 w-full rounded-[12px] border border-line bg-surface-2 p-3 transition-opacity
            disabled:opacity-40 sm:w-[13rem]"
        >
          <NewlineSplitPanel config={splitConfig} onChange={onSplitConfigChange} />
        </fieldset>
      </div>

      {/* Der Rahmen bleibt über den Moduswechsel hinweg montiert: gleiche Geometrie,
          erhaltene Scrollposition, kein Layout-Sprung. Der Marker-Hinweis steht
          bewusst UNTER dem Editor – über ihm würde er den Editor beim
          Einschalten nach unten schieben. */}
      <EditorFrame highlighted={isMarkerMode}>
        {isMarkerMode ? (
          <TextMarkerEditor
            rawText={rawText}
            sections={sections}
            onAddSection={onAddSection}
            onRemoveManualSection={onRemoveManualSection}
          />
        ) : (
          <TextSegmentEditor
            rawText={rawText}
            sections={sections}
            onRawTextChange={onRawTextChange}
            placeholder="Text eingeben oder Dokument hochladen …"
          />
        )}
      </EditorFrame>

      {isMarkerMode && (
        <p className="rounded-[10px] border border-accent/40 bg-accent-soft px-3 py-2 text-[11.5px] leading-relaxed text-accent-strong">
          Text markieren – oder zwei Wörter antippen (Anfang und Ende) – um einen Bereich zu einem Abschnitt
          zusammenzufassen. Einen manuellen Abschnitt antippen löst ihn wieder. Der Text ist solange
          schreibgeschützt.
        </p>
      )}

      {/* Fußzeile: manuelle Aktionen links, Text leeren rechts */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {canUndoManual && (
            <button
              type="button"
              onClick={onUndoManual}
              className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-3
                text-[12px] font-bold text-ink-muted transition-colors hover:text-ink"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Letzte manuelle Änderung rückgängig</span>
            </button>
          )}
          {manualRanges.length > 0 && (
            <button
              type="button"
              onClick={onClearManual}
              className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-3
                text-[12px] font-bold text-ink-faint transition-colors hover:text-danger"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Manuelle Aufteilung zurücksetzen</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={requestClear}
          disabled={rawText.length === 0}
          className="min-h-[36px] cursor-pointer rounded-full px-3 text-[12px] font-bold text-ink-faint
            transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          Text leeren
        </button>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Text wirklich leeren?"
          description="Der gesamte eingegebene Text wird entfernt – zusammen mit den manuellen Anpassungen, Ausschlüssen und der Reihenfolge. Die Einstellungen zu Zeichen und Enter bleiben erhalten."
          confirmLabel="Text leeren"
          destructive
          onConfirm={() => {
            setConfirmClear(false);
            onClearText();
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
};
