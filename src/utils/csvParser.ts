import type { WordItem } from '../types/game';

export const parseCSV = (text: string): WordItem[] => {
  if (!text || text.trim() === '') {
    return [];
  }

  const lines = text.split('\n');
  const parsedWords: WordItem[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Optional: Wenn es ein ; gibt, könnte man "Wort;Hinweis" erwarten,
    // aktuell nehmen wir einfach den ersten Teil als Wort.
    const parts = trimmedLine.split(';');
    const targetWord = parts[0].trim();

    if (targetWord) {
      parsedWords.push({
        id: crypto.randomUUID(),
        targetWord: targetWord,
        isCompleted: false,
      });
    }
  }

  return parsedWords;
};
