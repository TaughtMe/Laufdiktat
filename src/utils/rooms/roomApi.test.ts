import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const { openRoom, joinRoom, getRoomState, updateSession, endRoom, upsertProgress, getMyProgress, getRoomStudents, getRoomParticipants, removeRoomParticipant } =
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
      expect(rpcMock).toHaveBeenCalledWith('open_room_secure', { p_config: { foo: 'bar' } });
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

  describe('joinRoom', () => {
    it('mappt Raum, zugewiesenen Namen und Teilnehmertoken', async () => {
      rpcMock.mockResolvedValue({
        data: [{ room_id: 'r1', station_mode: false, status: 'lobby', assigned_student_key: 'Schlauer Igel', participant_token: 'ptok' }],
        error: null,
      });
      const result = await joinRoom('4821', 'Schlauer Igel', 'alt');
      expect(rpcMock).toHaveBeenCalledWith('join_room_secure', {
        p_code: '4821', p_student_key: 'Schlauer Igel', p_participant_token: 'alt',
      });
      expect(result).toEqual({ roomId: 'r1', stationMode: false, status: 'lobby', studentName: 'Schlauer Igel', participantToken: 'ptok' });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('gibt null zurück, wenn kein Raum existiert', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await joinRoom('9999', 'Igel')).toBeNull();
    });

    it('wirft bei einem Fehler statt still null zurückzugeben', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'network' } });
      await expect(joinRoom('4821', 'Igel')).rejects.toThrow('network');
    });

    it('versucht es nach einem einzelnen transienten Fehler erneut, statt sofort aufzugeben', async () => {
      rpcMock
        .mockRejectedValueOnce(new Error('kurzer WLAN-Aussetzer'))
        .mockResolvedValueOnce({ data: [{ room_id: 'r1', station_mode: false, status: 'lobby', assigned_student_key: 'Igel', participant_token: 'ptok' }], error: null });
      const result = await joinRoom('4821', 'Igel');
      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(result?.participantToken).toBe('ptok');
    });
  });

  describe('getRoomState', () => {
    it('mappt Status/Session/Config', async () => {
      rpcMock.mockResolvedValue({
        data: [{ status: 'live', session_id: 's1', config: { gameMode: 'LAUFDIKTAT' } }],
        error: null,
      });
      const result = await getRoomState('r1', { participantToken: 'ptok' });
      expect(rpcMock).toHaveBeenCalledWith('get_room_state_secure', {
        p_room_id: 'r1', p_participant_token: 'ptok', p_access_token: null,
      });
      expect(result).toEqual({ status: 'live', sessionId: 's1', config: { gameMode: 'LAUFDIKTAT' } });
    });

    it('gibt null zurück, wenn der Raum nicht existiert', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await getRoomState('unbekannt', { accessToken: 'teacher' })).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('sendet alle Parameter an update_session', async () => {
      rpcMock.mockResolvedValue({ error: null });
      await updateSession('r1', 'tok', 's1', { gameMode: 'LAUFDIKTAT' });
      expect(rpcMock).toHaveBeenCalledWith('update_session_secure', {
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
      expect(rpcMock).toHaveBeenCalledWith('end_room_secure', { p_room_id: 'r1', p_access_token: 'tok' });
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
        participantToken: 'ptok',
        studentKey: 'Schlauer Igel',
        currentIndex: 3,
        peeks: 1,
        attempts: 4,
        errors: 0,
        finished: false,
      });
      expect(rpcMock).toHaveBeenCalledWith('upsert_progress_secure', {
        p_room_id: 'r1',
        p_session_id: 's1',
        p_participant_token: 'ptok',
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
        participantToken: 'ptok',
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
      expect(rpcMock).toHaveBeenCalledWith('upsert_progress_secure', expect.objectContaining({
        p_duration_ms: 5000,
        p_word_errors: { Haus: 2 },
        p_app_version: '3.1.0',
        p_station_number: 3,
      }));
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ error: { message: 'boom' } });
      await expect(
        upsertProgress({ roomId: 'r1', sessionId: 's1', participantToken: 'ptok', studentKey: 'x', currentIndex: 0, peeks: 0, attempts: 0, errors: 0, finished: false })
      ).rejects.toThrow('boom');
    });
  });

  describe('getMyProgress', () => {
    it('mappt die gespeicherte Zeile', async () => {
      rpcMock.mockResolvedValue({
        data: [{ current_index: 2, peeks: 1, attempts: 3, errors: 1, finished: false }],
        error: null,
      });
      const result = await getMyProgress('r1', 's1', 'ptok', 'Schlauer Igel');
      expect(rpcMock).toHaveBeenCalledWith('get_my_progress_secure', {
        p_room_id: 'r1',
        p_session_id: 's1',
        p_participant_token: 'ptok',
        p_student_key: 'Schlauer Igel',
      });
      expect(result).toEqual({ currentIndex: 2, peeks: 1, attempts: 3, errors: 1, finished: false });
    });

    it('gibt null zurück, wenn noch kein Fortschritt existiert', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await getMyProgress('r1', 's1', 'ptok', 'x')).toBeNull();
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(getMyProgress('r1', 's1', 'ptok', 'x')).rejects.toThrow('boom');
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
      expect(rpcMock).toHaveBeenCalledWith('get_room_students_secure', { p_room_id: 'r1', p_access_token: 'tok' });
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

  describe('getRoomParticipants', () => {
    it('mappt registrierte Teilnehmer von snake_case auf camelCase', async () => {
      rpcMock.mockResolvedValue({
        data: [
          { student_key: 'Schlauer Igel', last_seen_at: '2026-07-21T09:00:00Z' },
          { student_key: 'Flinker Fuchs', last_seen_at: null },
        ],
        error: null,
      });
      const result = await getRoomParticipants('r1', 'tok');
      expect(rpcMock).toHaveBeenCalledWith('get_room_participants_secure', {
        p_room_id: 'r1',
        p_access_token: 'tok',
      });
      expect(result).toEqual([
        { studentKey: 'Schlauer Igel', lastSeenAt: '2026-07-21T09:00:00Z' },
        { studentKey: 'Flinker Fuchs', lastSeenAt: null },
      ]);
    });

    it('gibt eine leere Liste zurück, wenn der Token nicht passt', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });
      expect(await getRoomParticipants('r1', 'falsch')).toEqual([]);
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(getRoomParticipants('r1', 'tok')).rejects.toThrow('boom');
    });
  });

  describe('removeRoomParticipant', () => {
    it('sendet room_id, Token und den Teilnehmernamen', async () => {
      rpcMock.mockResolvedValue({ error: null });
      await removeRoomParticipant('r1', 'tok', 'Schlauer Igel');
      expect(rpcMock).toHaveBeenCalledWith('remove_room_participant_secure', {
        p_room_id: 'r1',
        p_access_token: 'tok',
        p_student_key: 'Schlauer Igel',
      });
    });

    it('wirft bei einem Fehler', async () => {
      rpcMock.mockResolvedValue({ error: { message: 'Ungueltiger Raum oder Token' } });
      await expect(removeRoomParticipant('r1', 'falsch', 'x')).rejects.toThrow('Ungueltiger Raum oder Token');
    });
  });
});
