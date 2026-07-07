import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveDashboardRoomSession, readDashboardRoomSession, clearDashboardRoomSession } from './dashboardRoomSession';

const makeFakeSessionStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
};

describe('dashboardRoomSession', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', makeFakeSessionStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gibt null zurück, wenn nichts gespeichert wurde', () => {
    expect(readDashboardRoomSession()).toBeNull();
  });

  it('speichert und liest roomId/accessToken/roomCode zurück', () => {
    saveDashboardRoomSession({ roomId: 'r1', accessToken: 'tok', roomCode: '4821' });
    expect(readDashboardRoomSession()).toEqual({ roomId: 'r1', accessToken: 'tok', roomCode: '4821' });
  });

  it('räumt die gespeicherte Sitzung', () => {
    saveDashboardRoomSession({ roomId: 'r1', accessToken: 'tok', roomCode: '4821' });
    clearDashboardRoomSession();
    expect(readDashboardRoomSession()).toBeNull();
  });

  it('bleibt robust bei kaputtem JSON', () => {
    vi.stubGlobal('sessionStorage', { ...makeFakeSessionStorage(), getItem: () => '{not-json' });
    expect(readDashboardRoomSession()).toBeNull();
  });

  it('bleibt robust bei unvollständigen Daten', () => {
    vi.stubGlobal('sessionStorage', { ...makeFakeSessionStorage(), getItem: () => JSON.stringify({ roomId: 'r1' }) });
    expect(readDashboardRoomSession()).toBeNull();
  });

  it('bleibt robust, wenn sessionStorage fehlt (z. B. privater Modus)', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => saveDashboardRoomSession({ roomId: 'r1', accessToken: 'tok', roomCode: '4821' })).not.toThrow();
    expect(readDashboardRoomSession()).toBeNull();
    expect(() => clearDashboardRoomSession()).not.toThrow();
  });
});
