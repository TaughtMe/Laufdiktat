import type { WordItem } from '../../types/game';

export const parseCSV = (text: string, mode: 'lines' | 'sentences'): WordItem[] => {
  if (!text || text.trim() === '') {
    return [];
  }

  let segments: string[];
  if (mode === 'sentences') {
    // Normalize newlines and extra spaces into a single space
    const normalizedText = text.replace(/\s+/g, ' ');
    segments = normalizedText.split(/(?<=[.!?])\s+/);
  } else {
    segments = text.split('\n');
  }
  
  const parsedWords: WordItem[] = [];

  for (const segment of segments) {
    const targetWord = segment.trim();
    if (!targetWord) continue;

    parsedWords.push({
      id: crypto.randomUUID(),
      targetWord,
      isCompleted: false,
    });
  }

  return parsedWords;
};
