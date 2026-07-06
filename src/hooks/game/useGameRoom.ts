import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { APP_VERSION } from '../../pwa';
import { getRoomState } from '../../utils/rooms/roomApi';
import type { WordItem, GameMode, BattleOptions, AttackType } from '../../types/game';

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
  /** Aus Home.tsx (findActiveRoom) – für den einmaligen DB-Fallback-Fetch unten. */
  roomId: string | undefined;
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
  currentWordIndexRef,
  onSessionStart,
  onSessionEnded,
  onAttack,
  enabled = true,
}: UseGameRoomArgs) => {
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [roster, setRoster] = useState<Record<string, number>>({}); // Name -> aktueller Wortindex
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Einmaliger DB-Fallback-Fetch pro Mount (siehe unten) – nicht bei jedem
  // Reconnect nötig, da ein bereits laufender Reconnect-Resync über den
  // bestehenden targetStudent-Broadcast abgedeckt ist (siehe oben).
  const hasFetchedRoomStateRef = useRef(false);

  useEffect(() => {
    if (!roomCode || !enabled) return;
    hasFetchedRoomStateRef.current = false;

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

    channel
      .on('broadcast', { event: 'session-start' }, (payload) => {
        const data = payload.payload as SessionStartData;
        // Gezielter Resync für einen anderen Schüler -> für uns nicht relevant.
        if (data.targetStudent && data.targetStudent !== studentName) return;
        onSessionStart(data);
      })
      .on('broadcast', { event: 'session-ended' }, () => {
        onSessionEnded();
      })
      .on('broadcast', { event: 'student-progress' }, (payload) => {
        const { name, index } = payload.payload;
        if (typeof name === 'string' && name !== studentName) {
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
        if (to !== studentName) return;
        onAttack(type);
      })
      .subscribe(async (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionWarning(true);
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
            await channel.track({ name: studentName, appVersion: APP_VERSION });
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
          if (roomId && !hasFetchedRoomStateRef.current) {
            try {
              const room = await getRoomState(roomId);
              // Erst NACH einem erfolgreichen Aufruf als "erledigt" markieren --
              // schlaegt genau dieser erste Versuch fehl (z. B. derselbe kurze
              // WLAN-Aussetzer, der den Reconnect ueberhaupt erst ausgeloest hat),
              // bleibt der Fallback fuer den naechsten Reconnect innerhalb
              // desselben Mounts nutzbar, statt dauerhaft deaktiviert zu sein.
              hasFetchedRoomStateRef.current = true;
              if (room && room.status === 'live' && room.sessionId) {
                onSessionStart({ ...(room.config as unknown as SessionStartData), sessionId: room.sessionId });
              }
            } catch (err) {
              console.error('[Room] get_room_state() fehlgeschlagen (Broadcast-Pfad bleibt Grundlage, naechster Reconnect versucht es erneut)', err);
            }
          }
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomCode, studentName, roomId, currentWordIndexRef, onSessionStart, onSessionEnded, onAttack, enabled]);

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

  return { connectionWarning, roster, sendProgress, sendFinished, sendAttack };
};
