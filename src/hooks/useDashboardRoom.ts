import { useEffect, useRef, useState, type RefObject } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';
import type { StationStudentState } from '../types/game';

export interface StudentResult {
  name?: string;
  peeks: number;
  attempts: number;
  errors?: number;
  durationMs?: number;
  totalLength?: number;
  wordCount?: number;
  wordErrors?: Record<string, number>;
}

type DashboardStep = 'IMPORT' | 'SETTINGS' | 'LOBBY' | 'LIVE';

// Liest beim Senden immer den AKTUELLEN Store-Stand – so kommen z. B. ein
// deaktivierter Ton oder geänderte Optionen garantiert frisch beim Schüler an
// (keine veralteten Werte aus alten Closures).
const buildSessionPayload = () => {
  const s = useGameStore.getState();
  return {
    words: s.words,
    gameMode: s.gameMode,
    battleOptions: s.battleOptions,
    stationMode: s.stationMode,
    stationCount: s.stationCount,
    isTtsEnabled: s.isTtsEnabled,
    uebungMaxAttempts: s.uebungMaxAttempts,
    showStars: s.showStars,
  };
};

interface UseDashboardRoomArgs {
  roomCode: string;
  setRoomCode: (code: string) => void;
  stepRef: RefObject<DashboardStep>;
  setCurrentStep: (step: DashboardStep) => void;
  wordsLength: number;
  clearWords: () => void;
}

/**
 * Kapselt die Supabase-Realtime-Logik des Lehrer-Dashboards: abonnierter
 * Channel, Live-Zustand der Schüler und die Aktionen Lobby öffnen / Sitzung
 * starten / beenden. Verhalten unverändert gegenüber der vorherigen Inline-Version.
 */
export const useDashboardRoom = ({
  roomCode,
  setRoomCode,
  stepRef,
  setCurrentStep,
  wordsLength,
  clearWords,
}: UseDashboardRoomArgs) => {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [studentsInLobby, setStudentsInLobby] = useState<string[]>([]);
  const [hadTwoConnections, setHadTwoConnections] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState(false);
  // Live-Fortschritt pro Schüler: Name -> Index des aktuellen Wortes.
  const [liveProgress, setLiveProgress] = useState<Record<string, number>>({});

  // Der abonnierte Realtime-Channel. Broadcasts (send) funktionieren nur auf
  // einem bereits abonnierten Channel, daher halten wir genau diese Instanz fest
  // und verwenden sie für alle Sende-Aktionen wieder.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Station mode RAM state
  const [stationStates, setStationStates] = useState<Map<number, StationStudentState>>(new Map());
  const stationStatesRef = useRef<Map<number, StationStudentState>>(new Map());

  useEffect(() => {
    stationStatesRef.current = stationStates;
  }, [stationStates]);

  const handleOpenLobby = async () => {
    if (wordsLength === 0) {
      alert('Bitte füge zuerst Wörter hinzu!');
      return;
    }
    setHadTwoConnections(false);

    // Falls bereits ein Channel offen ist (z. B. erneuter Klick auf "Lobby"),
    // diesen zuerst sauber entfernen, um doppelte Abos zu vermeiden.
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`room-${roomCode}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'student-joined' }, (payload) => {
      if (payload.payload?.name) {
        setStudentsInLobby((prev) => {
          if (!prev.includes(payload.payload.name)) {
            const next = [...prev, payload.payload.name];
            if (next.length >= 1) {
              setHadTwoConnections(true);
            }
            return next;
          }
          return prev;
        });

        if (stepRef.current === 'LIVE') {
          channel.send({
            type: 'broadcast',
            event: 'session-start',
            payload: buildSessionPayload(),
          });
        }
      }
    });

    channel.on('broadcast', { event: 'student-finished' }, (payload) => {
      setResults((prev) => [...prev, payload.payload as StudentResult]);
    });

    // Live-Fortschritt der Schüler mitschreiben (für die Schüler-Übersicht).
    channel.on('broadcast', { event: 'student-progress' }, (payload) => {
      const { name, index } = payload.payload;
      if (typeof name === 'string' && typeof index === 'number') {
        setLiveProgress((prev) => ({ ...prev, [name]: index }));
      }
    });

    // Station mode listeners
    channel.on('broadcast', { event: 'request-station-state' }, (payload) => {
      const { studentNumber } = payload.payload;
      const current = stationStatesRef.current.get(studentNumber) || { currentIndex: 0, peeks: 0 };
      channel.send({
        type: 'broadcast',
        event: 'sync-station-state',
        payload: { studentNumber, ...current },
      });
    });

    channel.on('broadcast', { event: 'update-station-state' }, (payload) => {
      const { studentNumber, currentIndex, peeks } = payload.payload;
      setStationStates((prev) => {
        const next = new Map(prev);
        next.set(studentNumber, { currentIndex, peeks });
        return next;
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionWarning(false);
        setCurrentStep('LOBBY');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionWarning(true);
      }
    });
  };

  const handleStartSession = async () => {
    // Auf dem bereits abonnierten Lobby-Channel senden – sonst kommt die
    // Nachricht bei den Schülern nicht an.
    if (!channelRef.current) {
      await handleOpenLobby();
    }
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'session-start',
      payload: buildSessionPayload(),
    });
    setCurrentStep('LIVE');
  };

  const handleEndSession = async () => {
    if (channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'session-ended' });
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCurrentStep('IMPORT');
    clearWords();
    setResults([]);
    setStudentsInLobby([]);
    setLiveProgress({});
    setHadTwoConnections(false);
    setStationStates(new Map());
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  };

  return {
    results,
    studentsInLobby,
    hadTwoConnections,
    connectionWarning,
    liveProgress,
    stationStates,
    handleOpenLobby,
    handleStartSession,
    handleEndSession,
  };
};
