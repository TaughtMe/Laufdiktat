import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { APP_VERSION } from '../../pwa';
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
}

interface UseGameRoomArgs {
  roomCode: string | undefined;
  studentName: string | undefined;
  currentWordIndexRef: RefObject<number>;
  onSessionStart: (data: SessionStartData) => void;
  onSessionEnded: () => void;
  onAttack: (type: AttackType) => void;
}

/**
 * Kapselt die Supabase-Realtime-Verbindung der Schülerseite: abonnierter
 * Channel, eingehende Events (Session-Start/-Ende, Fortschritt, Angriff) und
 * die Sende-Funktionen. Verhalten unverändert gegenüber der Inline-Version.
 */
export const useGameRoom = ({
  roomCode,
  studentName,
  currentWordIndexRef,
  onSessionStart,
  onSessionEnded,
  onAttack,
}: UseGameRoomArgs) => {
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [roster, setRoster] = useState<Record<string, number>>({}); // Name -> aktueller Wortindex
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase.channel(`room-${roomCode}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'session-start' }, (payload) => {
        onSessionStart(payload.payload as SessionStartData);
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
            await channel.send({
              type: 'broadcast',
              event: 'student-joined',
              payload: { name: studentName, version: APP_VERSION },
            });
            // Eigenen Fortschritt ankündigen und den der anderen abfragen.
            await channel.send({
              type: 'broadcast',
              event: 'student-progress',
              payload: { name: studentName, index: currentWordIndexRef.current },
            });
            await channel.send({ type: 'broadcast', event: 'request-progress', payload: {} });
          }
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomCode, studentName, currentWordIndexRef, onSessionStart, onSessionEnded, onAttack]);

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
