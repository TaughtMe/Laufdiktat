import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveSessionProgress, readSessionProgress, clearSessionProgress } from './sessionProgress';

const makeFakeLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
};

describe('sessionProgress', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeFakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gibt null zurück, wenn nichts gespeichert wurde', () => {
    expect(readSessionProgress('1234', 'Schlauer Igel', 'session-a')).toBeNull();
  });

  it('speichert und liest den Wortindex für dieselbe Sitzung zurück', () => {
    saveSessionProgress('1234', 'Schlauer Igel', 'session-a', 3);
    expect(readSessionProgress('1234', 'Schlauer Igel', 'session-a')).toBe(3);
  });

  it('ignoriert gespeicherten Fortschritt aus einer anderen Sitzung (neues "Diktat starten")', () => {
    saveSessionProgress('1234', 'Schlauer Igel', 'session-a', 3);
    expect(readSessionProgress('1234', 'Schlauer Igel', 'session-b')).toBeNull();
  });

  it('ignoriert gespeicherten Fortschritt eines anderen Schülers oder Raums', () => {
    saveSessionProgress('1234', 'Schlauer Igel', 'session-a', 3);
    expect(readSessionProgress('1234', 'Anderer Schüler', 'session-a')).toBeNull();
    expect(readSessionProgress('9999', 'Schlauer Igel', 'session-a')).toBeNull();
  });

  it('räumt den gemerkten Fortschritt', () => {
    saveSessionProgress('1234', 'Schlauer Igel', 'session-a', 3);
    clearSessionProgress();
    expect(readSessionProgress('1234', 'Schlauer Igel', 'session-a')).toBeNull();
  });

  it('bleibt robust bei kaputtem JSON', () => {
    vi.stubGlobal('localStorage', { ...makeFakeLocalStorage(), getItem: () => '{not-json' });
    expect(readSessionProgress('1234', 'Schlauer Igel', 'session-a')).toBeNull();
  });

  it('bleibt robust, wenn localStorage fehlt (z. B. privater Modus)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => saveSessionProgress('1234', 'Igel', 'session-a', 2)).not.toThrow();
    expect(readSessionProgress('1234', 'Igel', 'session-a')).toBeNull();
    expect(() => clearSessionProgress()).not.toThrow();
  });
});
