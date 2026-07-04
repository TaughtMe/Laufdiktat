import type { WordItem } from '../../types/game';

// Toleranz für numerische Mathe-Antworten: erlaubt schülerseitig gerundete
// Ergebnisse bei nicht-abbrechenden Brüchen/Wurzeln (z. B. 1/3, √2 -> 0,33
// statt 0,333333333), ohne echte Tippfehler durchzulassen.
const NUMERIC_TOLERANCE = 0.01;

/** Prüft eine Eingabe: bei Mathe (item.prompt gesetzt) numerisch (mit Toleranz), sonst als Text. */
export const checkAnswer = (item: WordItem, input: string): boolean => {
  const val = input.trim();
  if (item.prompt) {
    if (val === '') return false;
    const n = parseFloat(val.replace(',', '.'));
    return !Number.isNaN(n) && Math.abs(n - Number(item.targetWord)) < NUMERIC_TOLERANCE;
  }
  return val === item.targetWord;
};
