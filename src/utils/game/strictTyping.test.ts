import { describe, it, expect } from 'vitest';
import { isBlockedInputType, isSuspiciousBulkInsert, sanitizeMathInput } from './strictTyping';

describe('isBlockedInputType', () => {
  it('blockiert Einfügen/Ersetzen-Typen', () => {
    expect(isBlockedInputType('insertReplacementText')).toBe(true);
    expect(isBlockedInputType('insertFromPaste')).toBe(true);
    expect(isBlockedInputType('insertFromDrop')).toBe(true);
    expect(isBlockedInputType('insertFromYank')).toBe(true);
  });

  it('lässt normales Tippen und unbekannte/fehlende Typen durch', () => {
    expect(isBlockedInputType('insertText')).toBe(false);
    expect(isBlockedInputType('deleteContentBackward')).toBe(false);
    expect(isBlockedInputType(null)).toBe(false);
    expect(isBlockedInputType(undefined)).toBe(false);
    expect(isBlockedInputType('')).toBe(false);
  });
});

describe('isSuspiciousBulkInsert', () => {
  it('erkennt normales Tippen (ein Zeichen) nicht als verdächtig', () => {
    expect(isSuspiciousBulkInsert('Has', 'Hase')).toBe(false);
  });

  it('lässt Umlaute, ß, Leerzeichen und Satzzeichen beim Tippen zu (Anforderung 8)', () => {
    expect(isSuspiciousBulkInsert('Fu', 'Fuß')).toBe(false);
    expect(isSuspiciousBulkInsert('Bar', 'Bär')).toBe(false);
    expect(isSuspiciousBulkInsert('Guten', 'Guten ')).toBe(false);
    expect(isSuspiciousBulkInsert('Halt', 'Halt!')).toBe(false);
  });

  it('erkennt Einfügen mehrerer Zeichen auf einmal als verdächtig', () => {
    expect(isSuspiciousBulkInsert('', 'Hase')).toBe(true);
    expect(isSuspiciousBulkInsert('Ha', 'Hasenbau')).toBe(true);
  });

  it('behandelt Löschen/gleichbleibende Länge nicht als verdächtig', () => {
    expect(isSuspiciousBulkInsert('Hase', 'Has')).toBe(false);
    expect(isSuspiciousBulkInsert('Hase', 'Hase')).toBe(false);
  });
});

describe('sanitizeMathInput', () => {
  it('behält Ziffern, Minus, Komma und Punkt', () => {
    expect(sanitizeMathInput('12,5')).toBe('12,5');
    expect(sanitizeMathInput('-3.4')).toBe('-3.4');
  });

  it('entfernt Buchstaben und sonstige Zeichen', () => {
    expect(sanitizeMathInput('12abc')).toBe('12');
    expect(sanitizeMathInput('4 + 5')).toBe('45');
    expect(sanitizeMathInput('x=42')).toBe('42');
  });
});
