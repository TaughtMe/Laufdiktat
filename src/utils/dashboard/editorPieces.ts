import type { TextSection } from './textSections';

/**
 * Ein zusammenhängendes Stück des Rohtexts für die Darstellung im Editor.
 * `gap` ist alles, was zu keinem Abschnitt gehört – Whitespace zwischen
 * Abschnitten sowie verbrauchte Trenner (Zeilenumbrüche, eigene Trenner).
 */
export interface EditorPiece {
  text: string;
  start: number;
  kind: 'gap' | 'auto' | 'manual';
  section?: TextSection;
  /**
   * Fortlaufender Zähler NUR über die automatischen Abschnitte. Die Darstellung
   * färbt damit benachbarte Abschnitte abwechselnd ein, sodass die Grenze
   * zwischen zwei aufeinanderfolgenden Abschnitten sichtbar bleibt.
   * Hier berechnet und nicht beim Rendern hochgezählt – eine Mutation während
   * des Renderns wäre mit dem React Compiler nicht zulässig.
   */
  autoIndex: number;
}

/**
 * Zerlegt den Rohtext lückenlos in Stücke – die Abschnitte selbst plus alles
 * dazwischen. Lückenlos ist wesentlich: Mirror-Ebene und Marker-Ansicht müssen
 * exakt denselben Zeichenbestand rendern wie die Textarea, sonst verschieben
 * sich Zeilenumbrüche und Zeichenpositionen.
 *
 * Setzt voraus, dass `sections` nach `start` sortiert und überschneidungsfrei
 * ist – genau das liefert `buildTextSections`.
 */
export const buildEditorPieces = (rawText: string, sections: TextSection[]): EditorPiece[] => {
  const pieces: EditorPiece[] = [];
  let prev = 0;
  let autoIndex = 0;

  for (const s of sections) {
    if (s.start > prev) {
      pieces.push({ text: rawText.slice(prev, s.start), start: prev, kind: 'gap', autoIndex });
    }
    pieces.push({
      text: rawText.slice(s.start, s.end),
      start: s.start,
      kind: s.source,
      section: s,
      autoIndex,
    });
    if (s.source === 'auto') autoIndex += 1;
    prev = s.end;
  }

  if (prev < rawText.length) {
    pieces.push({ text: rawText.slice(prev), start: prev, kind: 'gap', autoIndex });
  }

  return pieces;
};
