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
   * useDashboardRoom: student-joined während LIVE). Ist das Feld gesetzt,
   * ignorieren alle anderen Schüler dieses Broadcast – sonst würde ein
   * einzelner Reconnect (z. B. kurzer WLAN-Aussetzer) die ganze Klasse
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
   * student-joined-Broadcasts nach einem Reconnect, die unnötigen
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
  // Nur beim allerersten erfolgreichen Verbinden "student-joined" senden (siehe
  // unten) – ein Realtime-Reconnect nach einem kurzen WLAN-Aussetzer liefert
  // ebenfalls den Status SUBSCRIBED, ist aber kein neuer Beitritt und darf die
  // Lehrkraft nicht zu einem Resync für den ganzen Raum verleiten.
  const hasAnnouncedJoinRef = useRef(false);
  // Einmaliger DB-Fallback-Fetch pro Mount (siehe unten) – nicht bei jedem
  // Reconnect nötig, da ein bereits laufender Reconnect-Resync über den
  // bestehenden targetStudent-Broadcast abgedeckt ist (siehe oben).
  const hasFetchedRoomStateRef = useRef(false);

  useEffect(() => {
    if (!roomCode || !enabled) return;
    hasAnnouncedJoinRef.current = false;
    hasFetchedRoomStateRef.current = false;

    const channel = supabase.channel(`room-${roomCode}`);
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
            if (!hasAnnouncedJoinRef.current) {
              hasAnnouncedJoinRef.current = true;
              await channel.send({
                type: 'broadcast',
                event: 'student-joined',
                payload: { name: studentName, version: APP_VERSION },
              });
            }
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
            hasFetchedRoomStateRef.current = true;
            try {
              const room = await getRoomState(roomId);
              if (room && room.status === 'live' && room.sessionId) {
                onSessionStart({ ...(room.config as unknown as SessionStartData), sessionId: room.sessionId });
              }
            } catch (err) {
              console.error('[Room] get_room_state() fehlgeschlagen (Broadcast-Pfad bleibt Grundlage)', err);
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
