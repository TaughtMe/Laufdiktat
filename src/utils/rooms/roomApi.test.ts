import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const { openRoom, findActiveRoom, getRoomState, updateSession, endRoom } = await import('./roomApi');

describe('roomApi', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  describe('openRoom', () => {
    it('ruft open_room mit p_config auf und mappt die Antwort', async () => {
      rpcMock.mockResolvedValue({
        data: [{ room_id: 'r1', code: '4821', access_token: 'tok' }],
        error: null,
      });
      const result = await openRoom({ foo: 'bar' });
      expect(rpcMock).toHaveBeenCalledWith('open_room', { p_config: { foo: 'bar' } });
      expect(result).toEqual({ roomId: 'r1', code: '4821', accessToken: 'tok' });
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(openRoom()).rejects.toThrow('boom');
    });

    it('wirft, wenn keine Zeile zurückkommt', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      await expect(openRoom()).rejects.toThrow();
    });
  });

  describe('findActiveRoom', () => {
    it('mappt einen gefundenen Raum ohne access_token', async () => {
      rpcMock.mockResolvedValue({
        data: [{ room_id: 'r1', station_mode: false, status: 'lobby' }],
        error: null,
      });
      const result = await findActiveRoom('4821');
      expect(rpcMock).toHaveBeenCalledWith('find_active_room', { p_code: '4821' });
      expect(result).toEqual({ roomId: 'r1', stationMode: false, status: 'lobby' });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('gibt null zurück, wenn kein Raum existiert', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await findActiveRoom('9999')).toBeNull();
    });

    it('wirft bei einem Fehler statt still null zurückzugeben', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'network' } });
      await expect(findActiveRoom('4821')).rejects.toThrow('network');
    });
  });

  describe('getRoomState', () => {
    it('mappt Status/Session/Config', async () => {
      rpcMock.mockResolvedValue({
        data: [{ status: 'live', session_id: 's1', config: { gameMode: 'LAUFDIKTAT' } }],
        error: null,
      });
      const result = await getRoomState('r1');
      expect(rpcMock).toHaveBeenCalledWith('get_room_state', { p_room_id: 'r1' });
      expect(result).toEqual({ status: 'live', sessionId: 's1', config: { gameMode: 'LAUFDIKTAT' } });
    });

    it('gibt null zurück, wenn der Raum nicht existiert', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await getRoomState('unbekannt')).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('sendet alle Parameter an update_session', async () => {
      rpcMock.mockResolvedValue({ error: null });
      await updateSession('r1', 'tok', 's1', { gameMode: 'LAUFDIKTAT' });
      expect(rpcMock).toHaveBeenCalledWith('update_session', {
        p_room_id: 'r1',
        p_access_token: 'tok',
        p_session_id: 's1',
        p_config: { gameMode: 'LAUFDIKTAT' },
      });
    });

    it('wirft bei falschem Token/Fehler', async () => {
      rpcMock.mockResolvedValue({ error: { message: 'Ungueltiger Raum oder Token' } });
      await expect(updateSession('r1', 'falsch', 's1', {})).rejects.toThrow('Ungueltiger Raum oder Token');
    });
  });

  describe('endRoom', () => {
    it('sendet room_id und Token', async () => {
      rpcMock.mockResolvedValue({ error: null });
      await endRoom('r1', 'tok');
      expect(rpcMock).toHaveBeenCalledWith('end_room', { p_room_id: 'r1', p_access_token: 'tok' });
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ error: { message: 'boom' } });
      await expect(endRoom('r1', 'tok')).rejects.toThrow('boom');
    });
  });
});
