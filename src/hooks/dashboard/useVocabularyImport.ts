import { useEffect, useState } from 'react';
import type { WordItem } from '../../types/game';
import {
  buildVocabularyItems,
  parseVocabularyTable,
  type VocabularyDirection,
  type VocabularyLanguage,
  type VocabularyPair,
  type VocabularySide,
} from '../../utils/dashboard/vocabulary';

type ImportMode = 'text' | 'math' | 'vocabulary';

const uid = () => crypto.randomUUID();
const emptySide = (): VocabularySide => ({ primary: '', alternatives: [] });
const emptyPair = (): VocabularyPair => ({ id: uid(), left: emptySide(), right: emptySide() });

export const VOCABULARY_LANGUAGES: VocabularyLanguage[] = [
  { label: 'Deutsch', speechCode: 'de-DE' },
  { label: 'Englisch', speechCode: 'en-GB' },
  { label: 'Französisch', speechCode: 'fr-FR' },
  { label: 'Spanisch', speechCode: 'es-ES' },
  { label: 'Italienisch', speechCode: 'it-IT' },
  { label: 'Niederländisch', speechCode: 'nl-NL' },
  { label: 'Polnisch', speechCode: 'pl-PL' },
  { label: 'Türkisch', speechCode: 'tr-TR' },
  { label: 'Ukrainisch', speechCode: 'uk-UA' },
  { label: 'Portugiesisch', speechCode: 'pt-PT' },
  { label: 'Russisch', speechCode: 'ru-RU' },
  { label: 'Griechisch', speechCode: 'el-GR' },
  { label: 'Schwedisch', speechCode: 'sv-SE' },
  { label: 'Dänisch', speechCode: 'da-DK' },
  { label: 'Norwegisch', speechCode: 'nb-NO' },
  { label: 'Arabisch', speechCode: 'ar' },
  { label: 'Chinesisch', speechCode: 'zh-CN' },
  { label: 'Japanisch', speechCode: 'ja-JP' },
  { label: 'Latein', speechCode: 'la' },
];

interface UseVocabularyImportOptions {
  importMode: ImportMode;
  setWords: (words: WordItem[]) => void;
}

export const useVocabularyImport = ({ importMode, setWords }: UseVocabularyImportOptions) => {
  const [pairs, setPairs] = useState<VocabularyPair[]>([emptyPair()]);
  const [leftLanguage, setLeftLanguage] = useState(VOCABULARY_LANGUAGES[0]);
  const [rightLanguage, setRightLanguage] = useState(VOCABULARY_LANGUAGES[1]);
  const [direction, setDirection] = useState<VocabularyDirection>('left-to-right');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [tableInput, setTableInput] = useState('');

  useEffect(() => {
    if (importMode !== 'vocabulary') return;
    setWords(buildVocabularyItems(pairs, direction, leftLanguage, rightLanguage, caseSensitive));
  }, [importMode, pairs, direction, leftLanguage, rightLanguage, caseSensitive, setWords]);

  const updatePair = (id: string, side: 'left' | 'right', patch: Partial<VocabularySide>) => {
    setPairs((current) => current.map((pair) =>
      pair.id === id ? { ...pair, [side]: { ...pair[side], ...patch } } : pair
    ));
  };

  const removePair = (id: string) => {
    setPairs((current) => {
      const next = current.filter((pair) => pair.id !== id);
      return next.length > 0 ? next : [emptyPair()];
    });
  };

  const addPair = () => setPairs((current) => [...current, emptyPair()]);

  const importTable = () => {
    const imported = parseVocabularyTable(tableInput).map((pair) => ({ ...pair, id: uid() }));
    if (imported.length === 0) return false;
    setPairs(imported);
    setTableInput('');
    return true;
  };

  return {
    pairs, updatePair, removePair, addPair,
    leftLanguage, setLeftLanguage, rightLanguage, setRightLanguage,
    direction, setDirection, caseSensitive, setCaseSensitive,
    tableInput, setTableInput, importTable,
    validCount: buildVocabularyItems(pairs, direction, leftLanguage, rightLanguage, caseSensitive).length,
  };
};
