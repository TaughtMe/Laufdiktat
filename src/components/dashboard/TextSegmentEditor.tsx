import React, { useLayoutEffect, useRef } from 'react';
import type { TextSection } from '../../utils/dashboard/textSections';
import { buildEditorPieces } from '../../utils/dashboard/editorPieces';
import {
  EDITOR_MIN_HEIGHT,
  EDITOR_TEXT_CLASSES,
  SEGMENT_AUTO_EVEN,
  SEGMENT_AUTO_ODD,
  SEGMENT_MANUAL,
} from './editorFrame';

interface TextSegmentEditorProps {
  rawText: string;
  sections: TextSection[];
  onRawTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}

/**
 * Der gemeinsame Editor im Normalzustand: zwei deckungsgleiche Ebenen.
 *
 *  1. Spiegel-Ebene (div, pointer-events:none) – zeigt denselben Text und färbt
 *     die berechneten Abschnitte direkt im Textfluss ein.
 *  2. Echte <textarea> darüber – transparenter Text, sichtbarer Cursor. Sie
 *     bleibt die tatsächliche Eingabe (kein contenteditable).
 *
 * Die Textarea wächst mit ihrem Inhalt und scrollt nie selbst; gescrollt wird
 * der umgebende EditorFrame. Dadurch haben beide Ebenen immer exakt dieselbe
 * Inhaltsbreite (siehe editorFrame.tsx).
 */
export const TextSegmentEditor = ({
  rawText,
  sections,
  onRawTextChange,
  placeholder,
}: TextSegmentEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Höhe an den Inhalt angleichen – die Textarea darf keine eigene Scrollbar
  // bekommen, sonst weicht ihre Inhaltsbreite von der Spiegel-Ebene ab.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Erst zurücksetzen, damit scrollHeight beim Kürzen nicht die alte, größere
    // Höhe zurückgibt. Die CSS-Mindesthöhe bleibt als Untergrenze wirksam.
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [rawText]);

  const pieces = buildEditorPieces(rawText, sections);

  return (
    // Positionierungs-Bezug für die Spiegel-Ebene. Wächst mit der Textarea und
    // scrollt mit ihr im Rahmen – deshalb liegt die Spiegel-Ebene hier drin und
    // nicht im (scrollenden) Rahmen selbst.
    <div className="relative min-h-full">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 text-ink ${EDITOR_TEXT_CLASSES}`}
      >
        {pieces.map((piece, idx) => {
          if (piece.kind === 'gap') return <span key={idx}>{piece.text}</span>;
          if (piece.kind === 'manual') {
            return (
              <span key={idx} className={SEGMENT_MANUAL}>
                {piece.text}
              </span>
            );
          }
          return (
            <span
              key={idx}
              className={piece.autoIndex % 2 === 0 ? SEGMENT_AUTO_EVEN : SEGMENT_AUTO_ODD}
            >
              {piece.text}
            </span>
          );
        })}
        {/* Endet der Text auf einem Umbruch, zeigt die Textarea eine zusätzliche
            Leerzeile, ein <div> jedoch nicht. Das Nullbreiten-Leerzeichen
            erzwingt dieselbe letzte Zeile in der Spiegel-Ebene. */}
        {rawText.endsWith('\n') && <span>{'​'}</span>}
      </div>

      <textarea
        ref={textareaRef}
        value={rawText}
        onChange={onRawTextChange}
        placeholder={placeholder}
        spellCheck={false}
        className={`relative block w-full resize-none overflow-hidden border-0 bg-transparent
          text-transparent caret-ink outline-none placeholder:text-ink-faint
          ${EDITOR_MIN_HEIGHT} ${EDITOR_TEXT_CLASSES}`}
      />
    </div>
  );
};
