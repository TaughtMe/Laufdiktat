import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const { openRoom, findActiveRoom, getRoomState, updateSession, endRoom, upsertProgress, getMyProgress, getRoomStudents } =
  await import('./roomApi');

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

    it('versucht es nach einem einzelnen transienten Fehler erneut, statt sofort aufzugeben', async () => {
      rpcMock
        .mockRejectedValueOnce(new Error('kurzer WLAN-Aussetzer'))
        .mockResolvedValueOnce({ data: [{ room_id: 'r1', station_mode: false, status: 'lobby' }], error: null });
      const result = await findActiveRoom('4821');
      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ roomId: 'r1', stationMode: false, status: 'lobby' });
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

  describe('upsertProgress', () => {
    it('sendet alle Felder inkl. Defaults für optionale Werte', async () => {
      rpcMock.mockResolvedValue({ error: null });
      await upsertProgress({
        roomId: 'r1',
        sessionId: 's1',
        studentKey: 'Schlauer Igel',
        currentIndex: 3,
        peeks: 1,
        attempts: 4,
        errors: 0,
        finished: false,
      });
      expect(rpcMock).toHaveBeenCalledWith('upsert_progress', {
        p_room_id: 'r1',
        p_session_id: 's1',
        p_student_key: 'Schlauer Igel',
        p_current_index: 3,
        p_peeks: 1,
        p_attempts: 4,
        p_errors: 0,
        p_finished: false,
        p_duration_ms: null,
        p_word_errors: null,
        p_app_version: null,
        p_station_number: null,
      });
    });

    it('gibt station_number/duration_ms/wordErrors/appVersion durch, wenn gesetzt', async () => {
      rpcMock.mockResolvedValue({ error: null });
      await upsertProgress({
        roomId: 'r1',
        sessionId: 's1',
        studentKey: 'station-3',
        currentIndex: 1,
        peeks: 0,
        attempts: 0,
        errors: 0,
        finished: true,
        durationMs: 5000,
        wordErrors: { Haus: 2 },
        appVersion: '3.1.0',
        stationNumber: 3,
      });
      expect(rpcMock).toHaveBeenCalledWith('upsert_progress', expect.objectContaining({
        p_duration_ms: 5000,
        p_word_errors: { Haus: 2 },
        p_app_version: '3.1.0',
        p_station_number: 3,
      }));
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ error: { message: 'boom' } });
      await expect(
        upsertProgress({ roomId: 'r1', sessionId: 's1', studentKey: 'x', currentIndex: 0, peeks: 0, attempts: 0, errors: 0, finished: false })
      ).rejects.toThrow('boom');
    });
  });

  describe('getMyProgress', () => {
    it('mappt die gespeicherte Zeile', async () => {
      rpcMock.mockResolvedValue({
        data: [{ current_index: 2, peeks: 1, attempts: 3, errors: 1, finished: false }],
        error: null,
      });
      const result = await getMyProgress('r1', 's1', 'Schlauer Igel');
      expect(rpcMock).toHaveBeenCalledWith('get_my_progress', {
        p_room_id: 'r1',
        p_session_id: 's1',
        p_student_key: 'Schlauer Igel',
      });
      expect(result).toEqual({ currentIndex: 2, peeks: 1, attempts: 3, errors: 1, finished: false });
    });

    it('gibt null zurück, wenn noch kein Fortschritt existiert', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await getMyProgress('r1', 's1', 'x')).toBeNull();
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(getMyProgress('r1', 's1', 'x')).rejects.toThrow('boom');
    });
  });

  describe('getRoomStudents', () => {
    it('mappt alle Zeilen von snake_case auf camelCase', async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            room_id: 'r1',
            session_id: 's1',
            student_key: 'Schlauer Igel',
            station_number: null,
            current_index: 4,
            peeks: 2,
            attempts: 5,
            errors: 1,
            finished: true,
            duration_ms: 9000,
            word_errors: { Haus: 1 },
            app_version: '3.1.0',
          },
        ],
        error: null,
      });
      const result = await getRoomStudents('r1', 'tok');
      expect(rpcMock).toHaveBeenCalledWith('get_room_students', { p_room_id: 'r1', p_access_token: 'tok' });
      expect(result).toEqual([{
        roomId: 'r1',
        sessionId: 's1',
        studentKey: 'Schlauer Igel',
        stationNumber: null,
        currentIndex: 4,
        peeks: 2,
        attempts: 5,
        errors: 1,
        finished: true,
        durationMs: 9000,
        wordErrors: { Haus: 1 },
        appVersion: '3.1.0',
      }]);
    });

    it('gibt eine leere Liste zurück, wenn der Token nicht passt', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await getRoomStudents('r1', 'falsch')).toEqual([]);
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(getRoomStudents('r1', 'tok')).rejects.toThrow('boom');
    });
  });
});
