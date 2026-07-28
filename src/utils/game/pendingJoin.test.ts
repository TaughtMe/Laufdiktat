import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  savePendingJoin,
  readPendingJoin,
  readRoomIdentity,
  clearPendingJoin,
  clearPendingJoinIntent,
} from './pendingJoin';

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

  it('speichert den unsichtbaren Teilnehmertoken über einen Update-Reload', () => {
    savePendingJoin('1234', 'Schlauer Igel', 'ptok');
    expect(readPendingJoin()).toEqual({ code: '1234', name: 'Schlauer Igel', participantToken: 'ptok' });
  });

  it('räumt den gespeicherten Beitritt vollständig', () => {
    savePendingJoin('1234', 'Schlauer Igel', 'ptok');
    clearPendingJoin();
    expect(readPendingJoin()).toBeNull();
    expect(readRoomIdentity('1234')).toBeNull();
  });

  it('übersteht wiederholtes Lesen (wird nicht beim Lesen geräumt)', () => {
    savePendingJoin('1234', 'Schlauer Igel');
    expect(readPendingJoin()).not.toBeNull();
    expect(readPendingJoin()).not.toBeNull();
  });

  describe('Intent/Token-Trennung', () => {
    it('clearPendingJoinIntent nimmt nur die Auto-Join-Absicht zurück, die Identität bleibt', () => {
      savePendingJoin('1234', 'Schlauer Igel', 'ptok');
      clearPendingJoinIntent();
      // Kein Auto-Join mehr beim nächsten Öffnen der Startseite ...
      expect(readPendingJoin()).toBeNull();
      // ... aber die Geräteidentität für den Raum bleibt wiederverwendbar.
      expect(readRoomIdentity('1234')).toEqual({ name: 'Schlauer Igel', participantToken: 'ptok' });
    });

    it('readRoomIdentity liefert nichts für einen anderen Raumcode', () => {
      savePendingJoin('1234', 'Schlauer Igel', 'ptok');
      expect(readRoomIdentity('9999')).toBeNull();
    });

    it('readRoomIdentity liefert nichts, wenn kein Token gespeichert wurde', () => {
      savePendingJoin('1234', 'Schlauer Igel');
      expect(readRoomIdentity('1234')).toBeNull();
    });

    it('ein erneutes savePendingJoin reaktiviert die Auto-Join-Absicht', () => {
      savePendingJoin('1234', 'Schlauer Igel', 'ptok');
      clearPendingJoinIntent();
      savePendingJoin('1234', 'Schlauer Igel', 'ptok');
      expect(readPendingJoin()).toEqual({ code: '1234', name: 'Schlauer Igel', participantToken: 'ptok' });
    });

    it('ein Beitritt zu einem NEUEN Raum ersetzt die alte Identität', () => {
      savePendingJoin('1234', 'Schlauer Igel', 'ptok');
      savePendingJoin('5678', 'Flinker Fuchs');
      expect(readRoomIdentity('1234')).toBeNull();
      expect(readRoomIdentity('5678')).toBeNull(); // noch kein Token für den neuen Raum
    });
  });

  it('bleibt robust, wenn sessionStorage fehlt (z. B. privater Modus)', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => savePendingJoin('1234', 'Igel')).not.toThrow();
    expect(readPendingJoin()).toBeNull();
    expect(readRoomIdentity('1234')).toBeNull();
    expect(() => clearPendingJoinIntent()).not.toThrow();
    expect(() => clearPendingJoin()).not.toThrow();
  });
});
