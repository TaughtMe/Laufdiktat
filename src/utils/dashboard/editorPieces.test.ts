import { describe, it, expect } from 'vitest';
import { buildEditorPieces } from './editorPieces';
import { buildTextSections, DEFAULT_SPLIT_CONFIG } from './textSections';

/** Zusammengesetzter Text aller Stücke – muss immer dem Rohtext entsprechen. */
const joined = (raw: string) =>
  buildEditorPieces(raw, buildTextSections(raw, DEFAULT_SPLIT_CONFIG))
    .map((p) => p.text)
    .join('');

describe('buildEditorPieces', () => {
  it('gibt bei leerem Text keine Stücke zurück', () => {
    expect(buildEditorPieces('', [])).toEqual([]);
  });

  it('deckt den Rohtext lückenlos ab', () => {
    // Entscheidend für die Spiegel-Ebene: fehlt ein Zeichen, verschieben sich
    // Zeilenumbrüche gegenüber der Textarea und die Einfärbung sitzt daneben.
    const raw = 'Eins. Zwei.\n\nDrei.';
    expect(joined(raw)).toBe(raw);
  });

  it('behält verbrauchte Trenner als Lücke bei', () => {
    const raw = 'A\nB';
    const pieces = buildEditorPieces(raw, buildTextSections(raw, DEFAULT_SPLIT_CONFIG));
    expect(pieces.map((p) => p.kind)).toEqual(['auto', 'gap', 'auto']);
    expect(pieces[1].text).toBe('\n');
    expect(joined(raw)).toBe(raw);
  });

  it('zählt nur automatische Abschnitte hoch', () => {
    const raw = 'Eins. Zwei. Drei.';
    const pieces = buildEditorPieces(raw, buildTextSections(raw, DEFAULT_SPLIT_CONFIG));
    const autos = pieces.filter((p) => p.kind === 'auto');
    expect(autos.map((p) => p.autoIndex)).toEqual([0, 1, 2]);
  });

  it('erhöht den Zähler bei manuellen Abschnitten nicht', () => {
    const raw = 'Eins. Zwei. Drei.';
    const sections = buildTextSections(raw, DEFAULT_SPLIT_CONFIG, [
      { id: 'm', type: 'section', start: 0, end: 11 },
    ]);
    const pieces = buildEditorPieces(raw, sections);
    expect(pieces.filter((p) => p.kind === 'manual')).toHaveLength(1);
    // Der einzige verbleibende automatische Abschnitt startet weiterhin bei 0.
    expect(pieces.filter((p) => p.kind === 'auto').map((p) => p.autoIndex)).toEqual([0]);
  });

  it('behält führenden und abschließenden Whitespace als Lücke', () => {
    const raw = '  Hallo.  ';
    expect(joined(raw)).toBe(raw);
    const pieces = buildEditorPieces(raw, buildTextSections(raw, DEFAULT_SPLIT_CONFIG));
    expect(pieces[0]).toMatchObject({ kind: 'gap', text: '  ' });
    expect(pieces[pieces.length - 1]).toMatchObject({ kind: 'gap', text: '  ' });
  });
});
