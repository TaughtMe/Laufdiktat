import type { WordItem } from '../../types/game';

/** Prüft eine Eingabe: bei Mathe (item.prompt gesetzt) numerisch, sonst als Text. */
export const checkAnswer = (item: WordItem, input: string): boolean => {
  const val = input.trim();
  if (item.prompt) {
    if (val === '') return false;
    const n = parseFloat(val.replace(',', '.'));
    return !Number.isNaN(n) && n === Number(item.targetWord);
  }
  return val === item.targetWord;
};
