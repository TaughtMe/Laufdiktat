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
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) continue;

    // Support CSV style ";" separation
    const parts = trimmedSegment.split(';');
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
