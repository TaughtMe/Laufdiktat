import { useRef } from 'react';
import type { TextSection } from '../../utils/dashboard/textSections';

interface TextMarkerEditorProps {
  rawText: string;
  sections: TextSection[];
  /** Auswahl eines zusammenhängenden Bereichs → genau ein Abschnitt. */
  onAddSection: (start: number, end: number) => void;
  /** Klick auf einen manuellen Abschnitt → dessen manuelle Markierung entfernen. */
  onRemoveManualSection: (section: TextSection) => void;
}

interface Piece {
  text: string;
  kind: 'gap' | 'auto' | 'manual';
  section?: TextSection;
}

/**
 * Nicht-editierbare Bearbeitungsansicht des Rohtexts (P3, Feinkonzept Abschnitt 6):
 * Der VOLLE Rohtext wird abschnittsweise eingefärbt dargestellt (Auto- vs.
 * manuelle Abschnitte). Eine Auswahl wird zu einem manuellen `section`-Bereich;
 * ein Klick auf einen manuellen Abschnitt entfernt ihn wieder.
 *
 * Wichtig: Es werden KEINE zusätzlichen Zeichen eingefügt – die Grenzen entstehen
 * rein über Styling. So bleibt der Textinhalt des Containers identisch zum
 * Rohtext, und die aus der Auswahl berechneten Zeichen-Indizes stimmen.
 */
export const TextMarkerEditor = ({ rawText, sections, onAddSection, onRemoveManualSection }: TextMarkerEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const pieces: Piece[] = [];
  let prev = 0;
  for (const s of sections) {
    if (s.start > prev) pieces.push({ text: rawText.slice(prev, s.start), kind: 'gap' });
    pieces.push({ text: rawText.slice(s.start, s.end), kind: s.source, section: s });
    prev = s.end;
  }
  if (prev < rawText.length) pieces.push({ text: rawText.slice(prev), kind: 'gap' });

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    // Absoluten Start-Index im Rohtext bestimmen (alles bis zum Auswahlbeginn messen).
    const pre = range.cloneRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    let start = pre.toString().length;
    let end = start + range.toString().length;

    // Leerzeichen an den Rändern ignorieren.
    const selected = rawText.substring(start, end);
    start += selected.length - selected.trimStart().length;
    end -= selected.length - selected.trimEnd().length;

    selection.removeAllRanges();
    if (start < end) onAddSection(start, end);
  };

  return (
    <div className="flex flex-col min-h-0">
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="w-full flex-1 min-h-[11rem] overflow-y-auto p-4 text-ink leading-[2] text-[15px] select-text break-words whitespace-pre-wrap rounded-[14px] bg-surface-2"
      >
        {pieces.map((p, idx) => {
          if (p.kind === 'gap') {
            return (
              <span key={idx} className="text-ink-faint">
                {p.text}
              </span>
            );
          }
          const manual = p.kind === 'manual';
          return (
            <span
              key={idx}
              onClick={manual ? () => onRemoveManualSection(p.section!) : undefined}
              title={manual ? 'Klicken zum Entfernen der manuellen Markierung' : undefined}
              className={`rounded-[6px] px-1 py-0.5 mx-px box-decoration-clone ${
                manual
                  ? 'bg-accent text-white font-semibold cursor-pointer hover:bg-danger transition-colors'
                  : 'bg-accent-soft text-accent-strong'
              }`}
            >
              {p.text}
            </span>
          );
        })}
      </div>
      <p className="text-[11.5px] text-ink-faint mt-2 leading-relaxed shrink-0">
        Text markieren, um einen Bereich zu einem Abschnitt zusammenzufassen. Klicke einen manuellen Abschnitt an, um ihn zu lösen.
      </p>
    </div>
  );
};
