import type { WordItem } from '../../types/game';

export type VocabularyDirection = 'left-to-right' | 'right-to-left' | 'mixed';

export interface VocabularySide {
  primary: string;
  alternatives: string[];
}

export interface VocabularyPair {
  id: string;
  left: VocabularySide;
  right: VocabularySide;
}

export interface VocabularyLanguage {
  label: string;
  speechCode: string;
}

const cleanAnswers = (side: VocabularySide): string[] => {
  const seen = new Set<string>();
  return [side.primary, ...side.alternatives]
    .map((value) => value.trim().replace(/\s+/g, ' '))
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const buildVocabularyItems = (
  pairs: VocabularyPair[],
  direction: VocabularyDirection,
  leftLanguage: VocabularyLanguage,
  rightLanguage: VocabularyLanguage,
  caseSensitive: boolean
): WordItem[] =>
  pairs.flatMap((pair, index) => {
    const left = cleanAnswers(pair.left);
    const right = cleanAnswers(pair.right);
    if (left.length === 0 || right.length === 0) return [];

    // Gemischt bleibt ausgewogen und stabil. Die bestehende Pro-Schüler-Mischung
    // verändert anschließend nur die Reihenfolge, nie Frage und Lösung selbst.
    const askLeft = direction === 'left-to-right' || (direction === 'mixed' && index % 2 === 0);
    const promptAnswers = askLeft ? left : right;
    const targetAnswers = askLeft ? right : left;
    const promptLanguage = askLeft ? leftLanguage : rightLanguage;
    const answerLanguage = askLeft ? rightLanguage : leftLanguage;

    return [{
      id: pair.id,
      kind: 'vocabulary' as const,
      prompt: promptAnswers[0],
      targetWord: targetAnswers[0],
      acceptedAnswers: targetAnswers.slice(1),
      caseSensitive,
      promptLang: promptLanguage.speechCode,
      answerLang: answerLanguage.speechCode,
      isCompleted: false,
    }];
  });

export const parseVocabularyTable = (input: string): VocabularyPair[] =>
  input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const cells = line.includes('\t') ? line.split('\t') : line.split(';');
      if (cells.length < 2) return [];
      const side = (value: string): VocabularySide => {
        const [primary = '', ...alternatives] = value.split('|').map((part) => part.trim()).filter(Boolean);
        return { primary, alternatives };
      };
      const left = side(cells[0]);
      const right = side(cells.slice(1).join(';'));
      if (!left.primary || !right.primary) return [];
      return [{ id: `vocab-import-${index}-${left.primary}-${right.primary}`, left, right }];
    });
