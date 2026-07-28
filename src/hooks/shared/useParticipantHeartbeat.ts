import { useEffect } from 'react';
import { touchParticipant } from '../../utils/rooms/roomApi';
import { HEARTBEAT_INTERVAL_MS } from '../../utils/rooms/presenceConfig';
import { logDevError } from '../../utils/shared/logging';

/**
 * Verbindungsunabhängiger DB-Heartbeat: markiert das Gerät regelmäßig als
 * "online" (room_participants.last_seen_at). Das Lehrer-Dashboard liest
 * diesen Zeitstempel und zeigt so schnell und zuverlässig, wer gerade
 * verbunden ist -- unabhängig davon, wie träge Supabase Presence einen
 * Abbruch bemerkt. Läuft die ganze Zeit im Raum (Lobby wie Live); wird
 * sowohl vom Direktmodus (useGameRoom) als auch vom Stationsmodus
 * (StationGame -- eigener Channel ohne Presence) verwendet.
 *
 * Wichtig fürs Verständnis: Der Heartbeat ist ein reines ANZEIGE-Signal.
 * Bleibt er aus, wird niemand aus dem Raum geworfen -- die Registrierung
 * (room_participants) und das Teilnehmertoken bleiben gültig; die Lobby-
 * Karte graut lediglich aus, bis der nächste Heartbeat eintrifft.
 *
 * Bewusst nur bei sichtbarem Tab: Ist das Gerät im Hintergrund/Standby, kann
 * der Schüler ohnehin nicht teilnehmen -- dann soll last_seen_at veralten und
 * das Gerät im Dashboard ehrlich ausgrauen, statt fälschlich "online" zu
 * zeigen. Kommt der Tab zurück, feuert sofort ein Heartbeat (visibilitychange).
 */
export const useParticipantHeartbeat = (
  roomId: string | undefined,
  participantToken: string | undefined,
  enabled = true
) => {
  useEffect(() => {
    if (!roomId || !participantToken || !enabled) return;
    let cancelled = false;

    const beat = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      touchParticipant(roomId, participantToken).catch((err) =>
        logDevError('[Room] Heartbeat fehlgeschlagen', err)
      );
    };

    beat();
    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => beat();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomId, participantToken, enabled]);
};
