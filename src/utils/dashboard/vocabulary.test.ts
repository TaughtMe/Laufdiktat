import { describe, expect, it } from 'vitest';
import { buildVocabularyItems, parseVocabularyTable, type VocabularyPair } from './vocabulary';

const de = { label: 'Deutsch', speechCode: 'de-DE' };
const en = { label: 'Englisch', speechCode: 'en-GB' };
const pairs: VocabularyPair[] = [
  { id: '1', left: { primary: 'Haus', alternatives: [] }, right: { primary: 'home', alternatives: ['house'] } },
  { id: '2', left: { primary: 'Baum', alternatives: [] }, right: { primary: 'tree', alternatives: [] } },
];

describe('buildVocabularyItems', () => {
  it('baut beide festen Richtungen mit Alternativantworten', () => {
    expect(buildVocabularyItems(pairs, 'left-to-right', de, en, false)[0]).toMatchObject({
      kind: 'vocabulary', prompt: 'Haus', targetWord: 'home', acceptedAnswers: ['house'], promptLang: 'de-DE', answerLang: 'en-GB', caseSensitive: false,
    });
    expect(buildVocabularyItems(pairs, 'right-to-left', de, en, true)[0]).toMatchObject({
      prompt: 'home', targetWord: 'Haus', promptLang: 'en-GB', answerLang: 'de-DE', caseSensitive: true,
    });
  });

  it('mischt Richtungen ausgewogen und überspringt unvollständige Paare', () => {
    const withEmpty = [...pairs, { id: '3', left: { primary: '', alternatives: [] }, right: { primary: 'x', alternatives: [] } }];
    const items = buildVocabularyItems(withEmpty, 'mixed', de, en, false);
    expect(items.map((item) => item.prompt)).toEqual(['Haus', 'tree']);
  });
});

describe('parseVocabularyTable', () => {
  it('liest Tabulatoren, Semikolons und mit | getrennte Alternativen', () => {
    const parsed = parseVocabularyTable('Haus\thome|house\nBaum;tree');
    expect(parsed).toHaveLength(2);
    expect(parsed[0].right).toEqual({ primary: 'home', alternatives: ['house'] });
  });
});
