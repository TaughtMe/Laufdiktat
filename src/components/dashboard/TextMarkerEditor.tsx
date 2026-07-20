import { useRef, useState } from 'react';
import type { TextSection } from '../../utils/dashboard/textSections';
import { buildEditorPieces, type EditorPiece } from '../../utils/dashboard/editorPieces';
import {
  EDITOR_MIN_HEIGHT,
  EDITOR_TEXT_CLASSES,
  SEGMENT_AUTO_EVEN,
  SEGMENT_AUTO_ODD,
  SEGMENT_MANUAL,
} from './editorFrame';

interface TextMarkerEditorProps {
  rawText: string;
  sections: TextSection[];
  /** Auswahl (Ziehen) bzw. zwei Wort-Taps → genau ein Abschnitt. */
  onAddSection: (start: number, end: number) => void;
  /** Klick auf einen manuellen Abschnitt → dessen manuelle Markierung entfernen. */
  onRemoveManualSection: (section: TextSection) => void;
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
 * Schreibgeschützter Marker-Zustand desselben Editors. Der VOLLE Rohtext wird
 * abschnittsweise eingefärbt dargestellt (automatisch vs. manuell).
 *
 * Zwei Wege, einen Bereich zu einem Abschnitt zu machen:
 *  - Ziehen (Desktop): Auswahl → Abschnitt (onMouseUp).
 *  - Antippen (Tablet, P5): erstes Wort = Anker, zweites Wort = Ende → Abschnitt.
 * Ein Klick auf einen manuellen Abschnitt löst ihn wieder.
 *
 * Wichtig: Es werden KEINE zusätzlichen Zeichen eingefügt – Grenzen entstehen
 * rein über Styling. So bleibt der Textinhalt identisch zum Rohtext, und die aus
 * der Auswahl berechneten Zeichen-Indizes stimmen.
 *
 * Typografie und Innenabstände kommen aus EDITOR_TEXT_CLASSES, die Einfärbung
 * aus denselben SEGMENT_*-Konstanten wie im Mirror-Editor. Zusammen mit dem
 * gemeinsamen, montiert bleibenden EditorFrame ergibt das beim Umschalten
 * keinen Layout-Sprung.
 */
export const TextMarkerEditor = ({ rawText, sections, onAddSection, onRemoveManualSection }: TextMarkerEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Erstes angetipptes Wort (Tablet-Auswahl); null = kein Anker gesetzt.
  const [anchor, setAnchor] = useState<{ start: number; end: number } | null>(null);

  const pieces = buildEditorPieces(rawText, sections);

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

  /**
   * Wort-Tipp-Ziele. Die Hervorhebung läuft ausschließlich über Hintergrund und
   * `ring` (ein Box-Shadow) – beides nimmt keinen Platz ein, der Text bleibt
   * exakt an derselben Stelle wie im Mirror-Editor.
   */
  const renderTokens = (piece: EditorPiece) =>
    tokenize(piece.text, piece.start).map((tok, ti) => {
      if (!tok.isWord) return <span key={ti}>{tok.text}</span>;
      const anchored = anchor !== null && tok.start === anchor.start && tok.end === anchor.end;
      return (
        <span
          key={ti}
          onClick={() => handleWordTap(tok)}
          className={`cursor-pointer rounded-[0.2rem] transition-colors ${
            anchored ? 'bg-accent/40 ring-2 ring-accent-strong' : 'hover:bg-accent/15'
          }`}
        >
          {tok.text}
        </span>
      );
    });

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={`select-text text-ink ${EDITOR_MIN_HEIGHT} ${EDITOR_TEXT_CLASSES}`}
    >
      {pieces.map((piece, idx) => {
        if (piece.kind === 'gap') return <span key={idx}>{renderTokens(piece)}</span>;

        if (piece.kind === 'manual') {
          return (
            <span
              key={idx}
              onClick={() => {
                setAnchor(null);
                onRemoveManualSection(piece.section!);
              }}
              title="Antippen, um die manuelle Markierung zu entfernen"
              className={`cursor-pointer transition-colors hover:bg-danger/25 ${SEGMENT_MANUAL}`}
            >
              {piece.text}
            </span>
          );
        }

        return (
          <span
            key={idx}
            className={piece.autoIndex % 2 === 0 ? SEGMENT_AUTO_EVEN : SEGMENT_AUTO_ODD}
          >
            {renderTokens(piece)}
          </span>
        );
      })}
    </div>
  );
};
