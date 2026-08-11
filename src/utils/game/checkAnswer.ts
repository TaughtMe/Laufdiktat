import type { WordItem } from '../../types/game';

// Toleranz für numerische Mathe-Antworten: erlaubt schülerseitig gerundete
// Ergebnisse bei nicht-abbrechenden Brüchen/Wurzeln (z. B. 1/3, √2 -> 0,33
// statt 0,333333333), ohne echte Tippfehler durchzulassen.
const NUMERIC_TOLERANCE = 0.01;

const normalizeVocabularyAnswer = (value: string, caseSensitive: boolean, language?: string): string => {
  const normalized = value.trim().replace(/\s+/g, ' ').normalize('NFC');
  return caseSensitive ? normalized : normalized.toLocaleLowerCase(language);
};

/** Prüft eine Eingabe abhängig vom expliziten Inhaltstyp (alte Sitzungen bleiben kompatibel). */
export const checkAnswer = (item: WordItem, input: string): boolean => {
  const val = input.trim();
  const isMath = item.kind === 'math' || (!item.kind && !!item.prompt);
  if (isMath) {
    if (val === '') return false;
    const n = parseFloat(val.replace(',', '.'));
    return !Number.isNaN(n) && Math.abs(n - Number(item.targetWord)) < NUMERIC_TOLERANCE;
  }
  if (item.kind === 'vocabulary') {
    if (val === '') return false;
    const actual = normalizeVocabularyAnswer(val, item.caseSensitive ?? false, item.answerLang);
    const accepted = [item.targetWord, ...(item.acceptedAnswers ?? [])];
    return accepted.some((answer) => normalizeVocabularyAnswer(answer, item.caseSensitive ?? false, item.answerLang) === actual);
  }
  return val === item.targetWord;
};
