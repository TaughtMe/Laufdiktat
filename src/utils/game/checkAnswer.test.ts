import { describe, it, expect } from 'vitest';
import { checkAnswer } from './checkAnswer';
import type { WordItem } from '../../types/game';

const wordItem = (targetWord: string): WordItem => ({ id: '1', targetWord, isCompleted: false });
const mathItem = (targetWord: string): WordItem => ({ id: '1', targetWord, prompt: '4 + 4', isCompleted: false });

describe('checkAnswer (Text)', () => {
  it('akzeptiert exakte Übereinstimmung', () => {
    expect(checkAnswer(wordItem('Haus'), 'Haus')).toBe(true);
  });

  it('trimmt die Eingabe, ist aber sonst case-/zeichensensitiv', () => {
    expect(checkAnswer(wordItem('Haus'), '  Haus  ')).toBe(true);
    expect(checkAnswer(wordItem('Haus'), 'haus')).toBe(false);
  });

  it('lehnt falsche Eingaben ab', () => {
    expect(checkAnswer(wordItem('Haus'), 'Baum')).toBe(false);
  });
});

describe('checkAnswer (Mathe)', () => {
  it('prüft numerisch, nicht als Text', () => {
    expect(checkAnswer(mathItem('8'), '8')).toBe(true);
  });

  it('akzeptiert Komma als Dezimaltrennzeichen', () => {
    expect(checkAnswer(mathItem('1.5'), '1,5')).toBe(true);
  });

  it('lehnt leere Eingabe ab', () => {
    expect(checkAnswer(mathItem('8'), '')).toBe(false);
    expect(checkAnswer(mathItem('8'), '   ')).toBe(false);
  });

  it('lehnt nicht-numerische Eingabe ab', () => {
    expect(checkAnswer(mathItem('8'), 'acht')).toBe(false);
  });

  it('lehnt falsches Ergebnis ab', () => {
    expect(checkAnswer(mathItem('8'), '7')).toBe(false);
  });
});
