import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { APP_VERSION } from '../../pwa';
import { getRoomState, touchParticipant } from '../../utils/rooms/roomApi';
import { HEARTBEAT_INTERVAL_MS } from '../../utils/rooms/presenceConfig';
import type { WordItem, GameMode, BattleOptions, AttackType } from '../../types/game';
import { logDevError } from '../../utils/shared/logging';

export interface SessionStartData {
  words: WordItem[];
  gameMode: GameMode;
  battleOptions: BattleOptions;
  stationMode?: boolean;
  stationCount?: number;
  isTtsEnabled?: boolean;
  uebungMaxAttempts?: number;
  showStars?: boolean;
  /** App-Version der Lehrkraft zum Zeitpunkt des Sendens (Kompatibilitäts-Check). */
  appVersion?: string;
  /** Reihenfolge pro Schüler mischen (siehe Game.tsx: onSessionStart). */
  shuffleWords?: boolean;
  /** Kennung der laufenden Sitzung – Teil des Shuffle-Seeds. */
  sessionId?: string;
  /** Strenger Eingabemodus: Einfügen/Autokorrektur erschweren (siehe utils/game/strictTyping.ts). */
  strictTypingMode?: boolean;
  /**
   * Gezielter Resync für genau einen (wieder-)beitretenden Schüler (siehe
   * useDashboardRoom: Presence-join-Event während LIVE). Ist das Feld
   * gesetzt, ignorieren alle anderen Schüler dieses Broadcast – sonst würde
   * ein einzelner Reconnect (z. B. kurzer WLAN-Aussetzer) die ganze Klasse
   * zurück auf Wort 1 werfen.
   */
  targetStudent?: string;
}

interface UseGameRoomArgs {
  roomCode: string | undefined;
  studentName: string | undefined;
  /** Aus Home.tsx (joinRoom) – für den autorisierten DB-Abgleich unten. */
  roomId: string | undefined;
  participantToken: string | undefined;
  currentWordIndexRef: RefObject<number>;
  onSessionStart: (data: SessionStartData) => void;
  onSessionEnded: () => void;
  onAttack: (type: AttackType) => void;
  /**
   * Im Stationsmodus übernimmt StationGame.tsx eine eigene, unabhängige
   * Channel-Verbindung zum selben Raum. Bleibt diese hier zusätzlich aktiv,
   * laufen zwei parallele Verbindungen im selben Tab – inklusive doppelter
   * Presence-Einträge/Broadcasts nach einem Reconnect, die unnötigen
   * Raum-Traffic und Cross-Talk-Risiken erzeugen. Sobald bekannt ist, dass
   * es sich um einen Stationsraum handelt (siehe Game.tsx), wird diese
   * Verbindung deaktiviert – StationGame.tsx hat zu dem Zeitpunkt längst
   * ihre eigene aufgebaut.
   */
  enabled?: boolean;
}

/**
 * Kapselt die Supabase-Realtime-Verbindung der Schülerseite: abonnierter
 * Channel, eingehende Events (Session-Start/-Ende, Fortschritt, Angriff) und
 * die Sende-Funktionen. Verhalten unverändert gegenüber der Inline-Version.
 */
export const useGameRoom = ({
  roomCode,
  studentName,
  roomId,
  participantToken,
  currentWordIndexRef,
  onSessionStart,
  onSessionEnded,
  onAttack,
  enabled = true,
}: UseGameRoomArgs) => {
  const [connectionWarning, setConnectionWarning] = useState(false);
  // Eigene Presence-Anmeldung bestätigt: erst wenn track() mit 'ok' quittiert
  // wurde, ist der Schüler in der Lehrer-Lobby wirklich sichtbar. Wird auf dem
  // Wartebildschirm angezeigt (siehe Game.tsx), damit ein hängendes Gerät
  // sofort auffällt statt still in der Lobby zu fehlen.
  const [presenceOk, setPresenceOk] = useState(false);
  const [roster, setRoster] = useState<Record<string, number>>({}); // Name -> aktueller Wortindex
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastIncomingAttackAtRef = useRef(0);
  // Einmaliger DB-Fallback-Fetch pro Mount (siehe unten) – nicht bei jedem
  // Reconnect nötig, da ein bereits laufender Reconnect-Resync über den
  // bestehenden targetStudent-Broadcast abgedeckt ist (siehe oben).
  const hasFetchedRoomStateRef = useRef(false);

  useEffect(() => {
    if (!roomCode || !roomId || !participantToken || !enabled) return;
    hasFetchedRoomStateRef.current = false;

    // Broadcasts sind nur noch ein schneller Hinweis, niemals die Quelle der
    // Sitzungswahrheit. Zustand und Konfiguration werden mit dem unsichtbaren
    // Teilnehmertoken aus der DB gelesen. Ein gefaelschtes session-start/-ended
    // kann dadurch weder Antworten einschleusen noch eine Sitzung beenden.
    const syncAuthoritativeRoomState = async () => {
      try {
        const room = await getRoomState(roomId, { participantToken });
        hasFetchedRoomStateRef.current = true;
        if (room?.status === 'live' && room.sessionId) {
          onSessionStart({ ...(room.config as unknown as SessionStartData), sessionId: room.sessionId });
        } else if (room?.status === 'ended') {
          onSessionEnded();
        }
      } catch (err) {
        logDevError('[Room] Autoritativer Raumabgleich fehlgeschlagen', err);
      }
    };

    // Presence-Key = Tiername, damit die Lehrkraft join/leave eindeutig
    // demselben Schüler zuordnen kann (siehe useDashboardRoom.ts). Ohne
    // studentName (sollte praktisch nicht vorkommen) generiert Supabase
    // selbst einen zufälligen Key – dann taucht der Schüler zwar nicht
    // namentlich im Presence-Roster auf, aber der Channel funktioniert
    // trotzdem unverändert.
    const channel = supabase.channel(
      `room-${roomCode}`,
      studentName ? { config: { presence: { key: studentName } } } : undefined
    );
    channelRef.current = channel;

    // Presence-Anmeldung mit Quittungsprüfung und Retry: track() kann
    // 'timed out' oder 'rate limited' zurückgeben. Ohne Retry bliebe der
    // Schüler dann dauerhaft unsichtbar in der Lehrer-Lobby (Channel
    // verbunden, aber nie in der Presence), während sein Gerät den ganz
    // normalen Wartebildschirm zeigt -- genau der "18 angemeldet, 17
    // sichtbar"-Fall aus dem Unterricht.
    const trackPresence = async (): Promise<void> => {
      if (!studentName) return;
      for (let attempt = 1; attempt <= 5; attempt++) {
        // Kanal wurde zwischenzeitlich abgebaut (Unmount/Neuaufbau) -- der
        // nächste SUBSCRIBED-Durchlauf des neuen Kanals übernimmt dann.
        if (channelRef.current !== channel) return;
        const result = await channel.track({ name: studentName, appVersion: APP_VERSION });
        if (result === 'ok') {
          setPresenceOk(true);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
      setPresenceOk(false);
      logDevError('[Room] Presence-Anmeldung wiederholt fehlgeschlagen', null);
    };

    // Gerät wacht aus dem Standby auf / Tab kommt zurück in den Vordergrund:
    // nicht passiv auf den Auto-Reconnect-Backoff warten, sondern sofort
    // anstoßen. Steht der Kanal noch, genügt eine frische Presence-Anmeldung;
    // war der Socket getrennt (Bildschirmsperre), beschleunigt connect() den
    // Wiederaufbau -- das folgende SUBSCRIBED-Event erledigt track/Resync dann
    // wie beim Erstbeitritt.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (channel.state === 'joined') {
        void trackPresence();
      } else {
        supabase.realtime.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    channel
      // Getrennte Mitspieler aus dem Battle-Roster nehmen: das Roster wuchs
      // bisher nur (Broadcast-basiert), wodurch ein Schüler, der die
      // Verbindung verlor, dauerhaft als Angriffsziel wählbar blieb -- der
      // Angriff verpuffte dann wirkungslos. Presence liefert den echten
      // Verbindungsstand; kommt der Mitspieler zurück, trägt ihn sein
      // nächstes student-progress-Broadcast automatisch wieder ein.
      .on('presence', { event: 'sync' }, () => {
        const present = new Set(Object.keys(channel.presenceState()));
        setRoster((prev) => {
          const entries = Object.entries(prev).filter(([name]) => present.has(name));
          return entries.length === Object.keys(prev).length ? prev : Object.fromEntries(entries);
        });
      })
      .on('broadcast', { event: 'session-start' }, () => {
        void syncAuthoritativeRoomState();
      })
      .on('broadcast', { event: 'session-ended' }, () => {
        void syncAuthoritativeRoomState();
      })
      .on('broadcast', { event: 'student-progress' }, (payload) => {
        const { name, index } = payload.payload;
        if (typeof name === 'string' && typeof index === 'number' && index >= 0 && index <= 10000 && name !== studentName) {
          setRoster((prev) => ({ ...prev, [name]: index }));
        }
      })
      .on('broadcast', { event: 'request-progress' }, () => {
        // Neuer Spieler fragt den Stand ab – eigenen Fortschritt erneut senden.
        if (studentName) {
          channel.send({
            type: 'broadcast',
            event: 'student-progress',
            payload: { name: studentName, index: currentWordIndexRef.current },
          });
        }
      })
      .on('broadcast', { event: 'attack' }, (payload) => {
        const { to, type } = payload.payload as { to: string; type: AttackType };
        if (to !== studentName || (type !== 'ink' && type !== 'flicker')) return;
        const now = Date.now();
        if (now - lastIncomingAttackAtRef.current < 1000) return;
        lastIncomingAttackAtRef.current = now;
        onAttack(type);
      })
      .subscribe(async (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionWarning(true);
          setPresenceOk(false);
        } else if (status === 'CLOSED') {
          setPresenceOk(false);
        } else if (status === 'SUBSCRIBED') {
          setConnectionWarning(false);
          if (studentName) {
            // Presence statt student-joined-Broadcast: track() muss nach
            // JEDEM (Re-)Connect erneut aufgerufen werden, da die vorherige
            // Presence-Zuordnung mit der alten Verbindung automatisch
            // verschwindet (siehe useDashboardRoom.ts: join/leave-Events).
            // Das ersetzt die frühere hasAnnouncedJoinRef-Gating-Logik –
            // Supabase unterscheidet echten Erstbeitritt und Reconnect jetzt
            // selbst, zuverlässiger als unser eigenes Heuristik-Flag.
            await trackPresence();
            // Eigenen Fortschritt ankündigen und den der anderen abfragen –
            // unschädlich, auch nach einem bloßen Reconnect erneut zu senden.
            await channel.send({
              type: 'broadcast',
              event: 'student-progress',
              payload: { name: studentName, index: currentWordIndexRef.current },
            });
            await channel.send({ type: 'broadcast', event: 'request-progress', payload: {} });
          }

          // Einmaliger DB-Fallback: falls die Sitzung schon lief, bevor wir
          // beigetreten sind (oder das session-start-Broadcast verpasst
          // wurde), holen wir den aktuellen Stand direkt statt endlos auf
          // einen Broadcast zu warten, der nie mehr kommt.
          if (!hasFetchedRoomStateRef.current) {
            await syncAuthoritativeRoomState();
          }
        }
      });

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      channelRef.current = null;
      setPresenceOk(false);
      supabase.removeChannel(channel);
    };
  }, [roomCode, studentName, roomId, participantToken, currentWordIndexRef, onSessionStart, onSessionEnded, onAttack, enabled]);

  // Verbindungsunabhängiger DB-Heartbeat: markiert das Gerät regelmäßig als
  // "online" (room_participants.last_seen_at). Das Lehrer-Dashboard liest
  // diesen Zeitstempel und zeigt so schnell und zuverlässig, wer gerade
  // verbunden ist -- unabhängig davon, wie träge Supabase Presence einen
  // Abbruch bemerkt (genau die zeitverzögerte "N verbunden"-Anzeige). Läuft
  // die ganze Zeit im Raum (Lobby wie Live), nicht nur während einer Runde --
  // gerade die Lobby-Wartephase war bisher ohne jeden DB-Kontakt.
  //
  // Bewusst nur bei sichtbarem Tab: Ist das Gerät im Hintergrund/Standby, kann
  // der Schüler ohnehin nicht teilnehmen -- dann soll last_seen_at veralten und
  // das Gerät im Dashboard ehrlich ausgrauen, statt fälschlich "online" zu
  // zeigen. Kommt der Tab zurück, feuert sofort ein Heartbeat (visibilitychange).
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

  const sendProgress = useCallback((index: number) => {
    if (studentName) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'student-progress',
        payload: { name: studentName, index },
      });
    }
  }, [studentName]);

  const sendFinished = useCallback((payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event: 'student-finished', payload });
  }, []);

  /** Schickt einen Angriff. Gibt false zurück, wenn (noch) kein Channel da ist. */
  const sendAttack = useCallback((to: string, type: AttackType): boolean => {
    if (!channelRef.current) return false;
    channelRef.current.send({
      type: 'broadcast',
      event: 'attack',
      payload: { from: studentName, to, type },
    });
    return true;
  }, [studentName]);

  return { connectionWarning, presenceOk, roster, sendProgress, sendFinished, sendAttack };
};
