import { useRef, useState } from 'react';
import type { TextSection } from '../../utils/dashboard/textSections';

interface TextMarkerEditorProps {
  rawText: string;
  sections: TextSection[];
  /** Auswahl (Ziehen) bzw. zwei Wort-Taps → genau ein Abschnitt. */
  onAddSection: (start: number, end: number) => void;
  /** Klick auf einen manuellen Abschnitt → dessen manuelle Markierung entfernen. */
  onRemoveManualSection: (section: TextSection) => void;
}

interface Piece {
  text: string;
  start: number;
  kind: 'gap' | 'auto' | 'manual';
  section?: TextSection;
}

interface Token {
  text: string;
  start: number;
  end: number;
  isWord: boolean;
}

/** Zerlegt einen Textausschnitt in Wort- und Nicht-Wort-Tokens (mit absoluten Positionen). */
const tokenize = (text: string, base: number): Token[] => {
  const tokens: Token[] = [];
  const regex = /(\p{L}+|\p{N}+)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), start: base + last, end: base + m.index, isWord: false });
    tokens.push({ text: m[0], start: base + m.index, end: base + regex.lastIndex, isWord: true });
    last = regex.lastIndex;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), start: base + last, end: base + text.length, isWord: false });
  return tokens;
};

/**
 * Nicht-editierbare Bearbeitungsansicht des Rohtexts (P3/P5). Der VOLLE Rohtext
 * wird abschnittsweise eingefärbt dargestellt (Auto- vs. manuelle Abschnitte).
 *
 * Zwei Wege, einen Bereich zu einem Abschnitt zu machen:
 *  - Ziehen (Desktop): Auswahl → Abschnitt (onMouseUp).
 *  - Antippen (Tablet): erstes Wort = Anker, zweites Wort = Ende → Abschnitt.
 * Ein Klick auf einen manuellen Abschnitt löst ihn wieder.
 *
 * Wichtig: Es werden KEINE zusätzlichen Zeichen eingefügt – Grenzen entstehen rein
 * über Styling. So bleibt der Textinhalt identisch zum Rohtext, und die aus der
 * Auswahl berechneten Zeichen-Indizes stimmen.
 */
export const TextMarkerEditor = ({ rawText, sections, onAddSection, onRemoveManualSection }: TextMarkerEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Erstes angetipptes Wort (Tablet-Auswahl); null = kein Anker gesetzt.
  const [anchor, setAnchor] = useState<{ start: number; end: number } | null>(null);

  const pieces: Piece[] = [];
  let prev = 0;
  for (const s of sections) {
    if (s.start > prev) pieces.push({ text: rawText.slice(prev, s.start), start: prev, kind: 'gap' });
    pieces.push({ text: rawText.slice(s.start, s.end), start: s.start, kind: s.source, section: s });
    prev = s.end;
  }
  if (prev < rawText.length) pieces.push({ text: rawText.slice(prev), start: prev, kind: 'gap' });

  const handleWordTap = (tok: Token) => {
    // Eine echte Auswahl (Ziehen) wird über onMouseUp behandelt – Klick ignorieren.
    if (!window.getSelection()?.isCollapsed) return;
    if (anchor === null) {
      setAnchor({ start: tok.start, end: tok.end });
      return;
    }
    const start = Math.min(anchor.start, tok.start);
    let end = Math.max(anchor.end, tok.end);
    // Unmittelbar folgende Satz-/Sonderzeichen (z. B. ".") noch mitnehmen, damit
    // sie nicht als winziger eigener Abschnitt übrig bleiben. Keine Buchstaben/
    // Ziffern und keinen Leerraum überspringen.
    while (end < rawText.length && /[^\s\p{L}\p{N}]/u.test(rawText[end])) end += 1;
    setAnchor(null);
    onAddSection(start, end);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const pre = range.cloneRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    let start = pre.toString().length;
    let end = start + range.toString().length;

    const selected = rawText.substring(start, end);
    start += selected.length - selected.trimStart().length;
    end -= selected.length - selected.trimEnd().length;

    selection.removeAllRanges();
    setAnchor(null);
    if (start < end) onAddSection(start, end);
  };

  const renderTokens = (piece: Piece) =>
    tokenize(piece.text, piece.start).map((tok, ti) => {
      if (!tok.isWord) return <span key={ti}>{tok.text}</span>;
      const anchored = anchor !== null && tok.start === anchor.start && tok.end === anchor.end;
      return (
        <span
          key={ti}
          onClick={() => handleWordTap(tok)}
          className={`cursor-pointer rounded px-0.5 transition-colors ${
            anchored ? 'ring-2 ring-accent-strong bg-accent/20' : 'hover:bg-accent/15'
          }`}
        >
          {tok.text}
        </span>
      );
    });

  return (
    <div className="flex flex-col min-h-0">
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="w-full flex-1 min-h-[11rem] overflow-y-auto p-4 text-ink leading-[2.1] text-[15px] select-text break-words whitespace-pre-wrap rounded-[14px] bg-surface-2"
      >
        {pieces.map((p, idx) => {
          if (p.kind === 'gap') {
            return (
              <span key={idx} className="text-ink-faint">
                {renderTokens(p)}
              </span>
            );
          }
          if (p.kind === 'manual') {
            return (
              <span
                key={idx}
                onClick={() => { setAnchor(null); onRemoveManualSection(p.section!); }}
                title="Klicken zum Entfernen der manuellen Markierung"
                className="rounded-[6px] px-1 py-0.5 mx-px box-decoration-clone bg-accent text-white font-semibold cursor-pointer hover:bg-danger transition-colors"
              >
                {p.text}
              </span>
            );
          }
          return (
            <span key={idx} className="rounded-[6px] px-1 py-0.5 mx-px box-decoration-clone bg-accent-soft text-accent-strong">
              {renderTokens(p)}
            </span>
          );
        })}
      </div>
      <p className="text-[11.5px] text-ink-faint mt-2 leading-relaxed shrink-0">
        Text markieren – oder zwei Wörter antippen (Anfang und Ende) – um einen Bereich zu einem Abschnitt zusammenzufassen. Einen manuellen Abschnitt antippen löst ihn wieder.
      </p>
    </div>
  );
};
