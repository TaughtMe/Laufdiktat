import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { savePendingJoin, readPendingJoin, clearPendingJoin } from './pendingJoin';

const makeFakeSessionStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
};

describe('pendingJoin', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', makeFakeSessionStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gibt null zurück, wenn nichts gespeichert wurde', () => {
    expect(readPendingJoin()).toBeNull();
  });

  it('speichert und liest Raumcode + Namen zurück', () => {
    savePendingJoin('1234', 'Schlauer Igel');
    expect(readPendingJoin()).toEqual({ code: '1234', name: 'Schlauer Igel' });
  });

  it('räumt den gespeicherten Beitritt', () => {
    savePendingJoin('1234', 'Schlauer Igel');
    clearPendingJoin();
    expect(readPendingJoin()).toBeNull();
  });

  it('übersteht wiederholtes Lesen (wird nicht beim Lesen geräumt)', () => {
    savePendingJoin('1234', 'Schlauer Igel');
    expect(readPendingJoin()).not.toBeNull();
    expect(readPendingJoin()).not.toBeNull();
  });

  it('bleibt robust, wenn sessionStorage fehlt (z. B. privater Modus)', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => savePendingJoin('1234', 'Igel')).not.toThrow();
    expect(readPendingJoin()).toBeNull();
    expect(() => clearPendingJoin()).not.toThrow();
  });
});
