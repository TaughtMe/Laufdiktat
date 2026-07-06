import { useEffect, useRef, useState, type RefObject } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useGameStore } from '../../store/gameStore';
import { APP_VERSION } from '../../pwa';
import { setStationProgress } from '../../utils/dashboard/stationProgress';
import type { StationStudentState } from '../../types/game';
import { openRoom, updateSession, endRoom } from '../../utils/rooms/roomApi';

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
// Enthält nur die Felder, die auch dauerhaft in rooms.config landen sollen
// (siehe roomApi.ts/updateSession) – sessionId/appVersion/targetStudent sind
// reine Broadcast-Zusatzfelder und gehören nicht in die persistierte Config
// (sessionId bekommt in der DB eine eigene Spalte, siehe Migration).
const buildRoomConfig = () => {
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
    // Im Stationsmodus nie mischen: Stationsnummern haben eine feste
    // räumliche Zuordnung zum Wort an der jeweiligen Station.
    shuffleWords: s.stationMode ? false : s.shuffleWords,
    strictTypingMode: s.strictTypingMode,
    // Stations-Variante: pro Schülernummer gemischt (siehe utils/game/stationShuffle.ts),
    // nur relevant und aktivierbar im Stationsmodus.
    stationShuffle: s.stationMode ? s.stationShuffle : false,
  };
};

// sessionId identifiziert die aktuelle Sitzung (siehe sessionIdRef unten) –
// wird für den deterministischen Pro-Schüler-Shuffle gebraucht: derselbe
// Schüler bekommt beim Reconnect innerhalb derselben Sitzung dieselbe
// Reihenfolge, eine neue Sitzung (erneutes "Diktat starten") mischt neu.
const buildSessionPayload = (sessionId: string, targetStudent?: string) => ({
  ...buildRoomConfig(),
  appVersion: APP_VERSION,
  sessionId,
  // Gesetzt beim Resync eines einzelnen (wieder-)beitretenden Schülers
  // während einer laufenden Sitzung (siehe unten) – alle anderen Schüler
  // ignorieren das Broadcast dann (siehe useGameRoom.ts).
  targetStudent,
});

interface UseDashboardRoomArgs {
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
  stepRef,
  setCurrentStep,
  wordsLength,
  clearWords,
}: UseDashboardRoomArgs) => {
  // Kommt jetzt von open_room() (siehe roomApi.ts) statt einem lokal
  // gewürfelten Code – erst gesetzt, sobald handleOpenLobby erfolgreich war.
  const [roomCode, setRoomCode] = useState('');
  // Nutzerfreundliche Fehlermeldung, falls open_room() fehlschlägt (z. B.
  // Migration noch nicht angewendet, oder Supabase nicht erreichbar).
  const [openLobbyError, setOpenLobbyError] = useState<string | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  // Wächst monoton über die ganze Sitzung (nie entfernen!) – wird für den
  // Live-Schritt und den CSV-Export gebraucht, wo auch ein Schüler sichtbar
  // bleiben soll, der nach dem Fertigwerden das Gerät zuklappt/die
  // Verbindung verliert. Für "wer ist GERADE verbunden" siehe
  // connectedStudents (Presence-basiert) unten.
  const [studentsInLobby, setStudentsInLobby] = useState<string[]>([]);
  // Presence-basiert (siehe handleOpenLobby): wer ist JETZT GERADE
  // verbunden. Schrumpft anders als studentsInLobby auch wieder, sobald ein
  // Gerät die Verbindung wirklich verliert (Supabase erkennt das über einen
  // Heartbeat) – wird für die Lobby-Ansicht und die "Verbindung
  // abgebrochen"-Erkennung gebraucht.
  const [connectedStudents, setConnectedStudents] = useState<Set<string>>(new Set());
  // App-Version je Schüler (aus der Presence-Payload), fürs Lobby-Kompatibilitäts-Badge.
  const [studentVersions, setStudentVersions] = useState<Record<string, string>>({});
  const [hadTwoConnections, setHadTwoConnections] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState(false);
  // Live-Fortschritt pro Schüler: Name -> Index des aktuellen Wortes.
  const [liveProgress, setLiveProgress] = useState<Record<string, number>>({});

  // Der abonnierte Realtime-Channel. Broadcasts (send) funktionieren nur auf
  // einem bereits abonnierten Channel, daher halten wir genau diese Instanz fest
  // und verwenden sie für alle Sende-Aktionen wieder.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Identifiziert die laufende Sitzung (siehe buildSessionPayload oben); wird
  // in handleStartSession neu erzeugt, in handleEndSession wieder geräumt.
  const sessionIdRef = useRef<string>('');
  // room_id/access_token aus open_room() – access_token bleibt ausschließlich
  // hier im Dashboard (siehe roomApi.ts: Schüler bekommen es nie).
  const roomIdRef = useRef<string>('');
  const accessTokenRef = useRef<string>('');

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
    setOpenLobbyError(null);
    setConnectedStudents(new Set());

    // Raum in der DB anlegen (Kahoot-artige, kollisionssichere Code-Vergabe,
    // siehe open_room() in der Migration). Schlägt das fehl (Migration noch
    // nicht angewendet, Supabase nicht erreichbar), brechen wir hier bewusst
    // hart ab -- ohne echten Code+Token ergibt der restliche Ablauf keinen Sinn.
    let room;
    try {
      room = await openRoom({});
    } catch (err) {
      console.error('[Room] open_room() fehlgeschlagen', err);
      setOpenLobbyError(
        'Der Raum konnte nicht angelegt werden. Bitte Internetverbindung prüfen und erneut versuchen.'
      );
      return;
    }
    roomIdRef.current = room.roomId;
    accessTokenRef.current = room.accessToken;
    setRoomCode(room.code);

    // Falls bereits ein Channel offen ist (z. B. erneuter Klick auf "Lobby"),
    // diesen zuerst sauber entfernen, um doppelte Abos zu vermeiden.
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`room-${room.code}`);
    channelRef.current = channel;

    // Presence statt student-joined-Broadcast: "sync" liefert nach jeder
    // Änderung den vollständigen, aktuellen Verbindungsstand (zuverlässiger
    // als Broadcasts, die einen Verbindungsabbruch strukturell nicht
    // erkennen können). "join" feuert zusätzlich gezielt für den einen
    // Schlüssel, der gerade (wieder-)verbunden hat -- das ersetzt den alten
    // student-joined-Trigger für den Resync unten 1:1, nur zuverlässiger.
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ name: string; appVersion?: string }>();
      const keys = Object.keys(state);
      setConnectedStudents(new Set(keys));
      if (keys.length >= 1) setHadTwoConnections(true);

      setStudentsInLobby((prev) => {
        const next = [...prev];
        for (const key of keys) {
          if (!next.includes(key)) next.push(key);
        }
        return next;
      });

      setStudentVersions((prev) => {
        const next = { ...prev };
        for (const [key, entries] of Object.entries(state)) {
          const version = entries[0]?.appVersion;
          if (typeof version === 'string') next[key] = version;
        }
        return next;
      });
    });

    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (stepRef.current === 'LIVE') {
        // Späterer Beitritt/Reconnect innerhalb derselben Sitzung -> dieselbe
        // sessionId, damit der Schüler dieselbe gemischte Reihenfolge bekommt.
        // Gezielt nur an diesen einen Schüler (targetStudent) – sonst würde
        // ein einzelner Reconnect (z. B. kurzer WLAN-Aussetzer) alle anderen,
        // bereits laufenden oder sogar schon fertigen Schüler mit zurücksetzen.
        channel.send({
          type: 'broadcast',
          event: 'session-start',
          payload: buildSessionPayload(sessionIdRef.current, key),
        });
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
      const { studentNumber, currentIndex, peeks, finished } = payload.payload;
      setStationStates((prev) => setStationProgress(prev, studentNumber, { currentIndex, peeks, finished }));
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
    // handleOpenLobby kann fehlschlagen (siehe dort) -- dann gibt es weder
    // Channel noch roomId/Token, hier ist nichts weiter zu tun.
    if (!channelRef.current || !roomIdRef.current) return;

    // Neue Sitzung -> neue sessionId, damit ein frischer Shuffle-Seed entsteht
    // (bei erneutem "Diktat starten" bekommen Schüler eine neue Reihenfolge).
    sessionIdRef.current = crypto.randomUUID();

    // Persistieren ist ein Best-Effort-Sicherheitsnetz für Resyncs, nicht
    // Voraussetzung fürs Starten -- der bewährte Broadcast-Pfad direkt danach
    // funktioniert unabhängig davon (z. B. wenn Phase-0-Migration auf diesem
    // Supabase-Projekt noch nicht angewendet wurde).
    try {
      await updateSession(roomIdRef.current, accessTokenRef.current, sessionIdRef.current, buildRoomConfig());
    } catch (err) {
      console.error('[Room] update_session() fehlgeschlagen (Sitzung startet trotzdem)', err);
    }

    await channelRef.current.send({
      type: 'broadcast',
      event: 'session-start',
      payload: buildSessionPayload(sessionIdRef.current),
    });
    setCurrentStep('LIVE');
  };

  const handleEndSession = async () => {
    if (roomIdRef.current) {
      try {
        await endRoom(roomIdRef.current, accessTokenRef.current);
      } catch (err) {
        console.error('[Room] end_room() fehlgeschlagen (Code bleibt evtl. länger reserviert)', err);
      }
    }
    if (channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'session-ended' });
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCurrentStep('IMPORT');
    clearWords();
    setResults([]);
    setStudentsInLobby([]);
    setConnectedStudents(new Set());
    setStudentVersions({});
    setLiveProgress({});
    setHadTwoConnections(false);
    setStationStates(new Map());
    // Kein neuer Code hier -- der nächste handleOpenLobby()-Aufruf holt sich
    // über open_room() einen frischen, kollisionsgeprüften Code.
    setRoomCode('');
    roomIdRef.current = '';
    accessTokenRef.current = '';
    sessionIdRef.current = '';
  };

  return {
    roomCode,
    openLobbyError,
    results,
    studentsInLobby,
    connectedStudents,
    studentVersions,
    hadTwoConnections,
    connectionWarning,
    liveProgress,
    stationStates,
    handleOpenLobby,
    handleStartSession,
    handleEndSession,
  };
};
