// Strenger Eingabemodus: Schülerantworten sollen möglichst nur durch
// normales Tippen entstehen. Einfügen/Autokorrektur/Wortvorschläge sollen
// erschwert werden. Reine, testbare Entscheidungsfunktionen – das eigentliche
// Verdrahten (preventDefault etc.) passiert direkt an der <input> in
// Game.tsx, hier steckt nur die Logik, WAS blockiert/erlaubt wird.

/** input-Attribute für den strengen Modus (aus, damit der Browser möglichst
 * wenig automatisch vorschlägt/ersetzt). Im normalen Modus gilt weiterhin das
 * Standardverhalten des Browsers (kein Attribut gesetzt). */
export const STRICT_INPUT_ATTRS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
} as const;

// beforeinput-Event-Typen, die im strengen Modus verhindert werden:
// Einfügen aus Zwischenablage/Drag&Drop/mittlerer Maustaste (X11 "Yank") und
// Autokorrektur-Ersetzungen. Normales Tippen (insertText) bleibt erlaubt.
const BLOCKED_INPUT_TYPES = new Set([
  'insertReplacementText',
  'insertFromPaste',
  'insertFromDrop',
  'insertFromYank',
]);

export const isBlockedInputType = (inputType: string | null | undefined): boolean =>
  !!inputType && BLOCKED_INPUT_TYPES.has(inputType);

/**
 * Fallback, falls onPaste/onDrop/onBeforeInput umgangen wurden (z. B. manche
 * mobile Tastaturen oder Passwort-/Formular-Autofill lösen kein sauberes
 * beforeinput aus): true, wenn der Feldinhalt in einem Schritt um mehr als
 * ein Zeichen gewachsen ist – normales Tippen (auch Umlaute/ß/Leerzeichen/
 * Satzzeichen, je ein Zeichen pro Tastendruck) liefert dabei immer `false`.
 */
export const isSuspiciousBulkInsert = (prevValue: string, nextValue: string): boolean =>
  nextValue.length - prevValue.length > 1;

/** Mathe-Antworten im strengen Modus: nur Ziffern, Minus, Komma, Punkt. */
export const sanitizeMathInput = (value: string): string => value.replace(/[^0-9,.-]/g, '');
