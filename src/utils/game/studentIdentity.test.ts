import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveStudentIdentity, getStudentNameForRoom, clearStudentIdentity } from './studentIdentity';

const makeFakeLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
};

describe('studentIdentity', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeFakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gibt null zurück, wenn nichts gespeichert wurde', () => {
    expect(getStudentNameForRoom('4821')).toBeNull();
  });

  it('speichert und liest den Namen für denselben Raum-Code zurück', () => {
    saveStudentIdentity('4821', 'Schlauer Igel');
    expect(getStudentNameForRoom('4821')).toBe('Schlauer Igel');
  });

  it('ignoriert den gespeicherten Namen für einen anderen Raum-Code', () => {
    saveStudentIdentity('4821', 'Schlauer Igel');
    expect(getStudentNameForRoom('9999')).toBeNull();
  });

  it('überschreibt den vorherigen Eintrag bei einem neuen Raum-Code', () => {
    saveStudentIdentity('4821', 'Schlauer Igel');
    saveStudentIdentity('9999', 'Schneller Fuchs');
    expect(getStudentNameForRoom('4821')).toBeNull();
    expect(getStudentNameForRoom('9999')).toBe('Schneller Fuchs');
  });

  it('räumt den gemerkten Namen', () => {
    saveStudentIdentity('4821', 'Schlauer Igel');
    clearStudentIdentity();
    expect(getStudentNameForRoom('4821')).toBeNull();
  });

  it('bleibt robust bei kaputtem JSON', () => {
    vi.stubGlobal('localStorage', { ...makeFakeLocalStorage(), getItem: () => '{not-json' });
    expect(getStudentNameForRoom('4821')).toBeNull();
  });

  it('bleibt robust, wenn localStorage fehlt (z. B. privater Modus)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => saveStudentIdentity('4821', 'Igel')).not.toThrow();
    expect(getStudentNameForRoom('4821')).toBeNull();
    expect(() => clearStudentIdentity()).not.toThrow();
  });
});
