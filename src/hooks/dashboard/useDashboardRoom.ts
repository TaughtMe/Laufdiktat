import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useGameStore } from '../../store/gameStore';
import { APP_VERSION } from '../../pwa';
import type { StationStudentState, WordItem } from '../../types/game';
import {
  openRoom,
  updateSession,
  endRoom,
  getRoomState,
  getRoomStudents,
  getRoomParticipants,
  removeRoomParticipant,
  type RoomStudentRow,
  type RoomParticipantRow,
} from '../../utils/rooms/roomApi';
import { ONLINE_THRESHOLD_MS, PARTICIPANTS_POLL_MS } from '../../utils/rooms/presenceConfig';
import {
  saveDashboardRoomSession,
  readDashboardRoomSession,
  clearDashboardRoomSession,
} from '../../utils/dashboard/dashboardRoomSession';
import { logDevError } from '../../utils/shared/logging';

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
// (siehe roomApi.ts/updateSession). sessionId bekommt in der DB eine eigene
// Spalte; appVersion liegt absichtlich in der autorisierten Config.
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
    // Wird mit der restlichen Konfiguration serverseitig gespeichert. Schüler
    // übernehmen die Version dadurch aus dem autorisierten DB-Zustand statt
    // aus einem fälschbaren Realtime-Broadcast.
    appVersion: APP_VERSION,
  };
};

// sessionId identifiziert die aktuelle Sitzung (siehe sessionIdRef unten) –
// wird für den deterministischen Pro-Schüler-Shuffle gebraucht: derselbe
// Schüler bekommt beim Reconnect innerhalb derselben Sitzung dieselbe
// Reihenfolge, eine neue Sitzung (erneutes "Diktat starten") mischt neu.
const buildSessionPayload = (_sessionId: string, targetStudent?: string) => ({
  // Keine Aufgaben oder Lösungen mehr im öffentlichen Broadcast. Der Event
  // weckt nur die Clients; diese lesen die Konfiguration anschließend mit
  // ihrem Teilnehmertoken aus get_room_state_secure(). appVersion bleibt als
  // Update-Hinweis für noch geöffnete 4.0.3-Clients erhalten.
  appVersion: APP_VERSION,
  targetStudent,
});

// Nach einem Reload ist der Zustand-Store (Wörter, Modus, ...) leer -- die
// gespeicherte rooms.config ist die einzige Quelle, um ihn für die
// Wiederherstellung (siehe restoreDashboardSession unten) zu befüllen.
const hydrateStoreFromConfig = (config: Record<string, unknown>) => {
  const s = useGameStore.getState();
  if (Array.isArray(config.words)) s.setWords(config.words as WordItem[]);
  if (typeof config.gameMode === 'string') s.setGameMode(config.gameMode as typeof s.gameMode);
  if (config.battleOptions && typeof config.battleOptions === 'object') {
    s.setBattleOptions(config.battleOptions as Partial<typeof s.battleOptions>);
  }
  if (typeof config.stationMode === 'boolean') s.setStationMode(config.stationMode);
  if (typeof config.stationCount === 'number') s.setStationCount(config.stationCount);
  if (typeof config.isTtsEnabled === 'boolean') s.setTtsEnabled(config.isTtsEnabled);
  if (typeof config.uebungMaxAttempts === 'number') s.setUebungMaxAttempts(config.uebungMaxAttempts);
  if (typeof config.showStars === 'boolean') s.setShowStars(config.showStars);
  if (typeof config.shuffleWords === 'boolean') s.setShuffleWords(config.shuffleWords);
  if (typeof config.strictTypingMode === 'boolean') s.setStrictTypingMode(config.strictTypingMode);
  if (typeof config.stationShuffle === 'boolean') s.setStationShuffle(config.stationShuffle);
};

/** Baut die Ergebnisliste (Direktmodus, für Live-Ansicht/CSV-Export) aus persistierten Schülerzeilen. */
const resultsFromStudents = (students: RoomStudentRow[]): StudentResult[] =>
  students
    .filter((s) => s.finished)
    .map((s) => ({
      name: s.studentKey,
      peeks: s.peeks,
      attempts: s.attempts,
      errors: s.errors,
      durationMs: s.durationMs ?? undefined,
      wordErrors: s.wordErrors,
    }));

/** Baut die Stationsübersicht aus persistierten Schülerzeilen. */
const stationStatesFromStudents = (students: RoomStudentRow[]): Map<number, StationStudentState> => {
  const map = new Map<number, StationStudentState>();
  for (const s of students) {
    if (s.stationNumber != null) {
      map.set(s.stationNumber, { currentIndex: s.currentIndex, peeks: s.peeks, finished: s.finished });
    }
  }
  return map;
};

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
  // Presence-Signal (siehe handleOpenLobby): welche Schlüssel meldet Supabase
  // Presence gerade als verbunden. Nur noch EIN Eingang in die Online-Erkennung
  // -- der zweite, robustere ist der last_seen_at-Heartbeat aus der DB (siehe
  // connectedStudents/participants unten). Presence liefert das sofortige
  // Beitritts-/Verlassen-Signal, bemerkt einen echten Abbruch aber erst nach
  // 30-90s; der DB-Heartbeat gleicht genau diese Trägheit aus.
  const [presentKeys, setPresentKeys] = useState<Set<string>>(new Set());
  // DB-Sicht der Lobby: alle im Raum REGISTRIERTEN Teilnehmer samt
  // last_seen_at (siehe room_participants / get_room_participants_secure).
  // Quelle sowohl für die ausgegrauten "getrennt"-Karten als auch für die
  // schnelle, verbindungsunabhängige Online-Erkennung (connectedStudents).
  const [participants, setParticipants] = useState<RoomParticipantRow[]>([]);
  // App-Version je Schüler (aus der Presence-Payload), fürs Lobby-Kompatibilitäts-Badge.
  const [studentVersions, setStudentVersions] = useState<Record<string, string>>({});
  const [hadTwoConnections, setHadTwoConnections] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState(false);
  // Live-Fortschritt pro Schüler: Name -> Index des aktuellen Wortes.
  const [liveProgress, setLiveProgress] = useState<Record<string, number>>({});

  // Reaktive "Jetzt"-Zeit für die last_seen_at-Frischeprüfung unten. Ein
  // direktes Date.now() im useMemo wäre nicht idempotent (React-Purity-Regel);
  // stattdessen tickt dieser Wert bei jedem Poll (siehe Poll-Effekt) und beim
  // Zurückkommen des Tabs, sodass ein Schüler, der aufhört zu heartbeaten, im
  // Takt des Polls ausgraut.
  const [nowTs, setNowTs] = useState(() => Date.now());

  // Alle im Raum registrierten Teilnehmer (auch gerade getrennte). Aus der DB,
  // damit ein Schüler im Standby nicht kommentarlos verschwindet, sondern
  // ausgegraut sichtbar bleibt.
  const registeredStudents = useMemo(() => participants.map((p) => p.studentKey), [participants]);

  // "Wer ist JETZT verbunden" aus ZWEI Signalen verschmolzen: Presence (sofort,
  // aber träge beim Abbruch) ODER ein frischer last_seen_at-Heartbeat (robust,
  // verbindungsunabhängig). Ein Gerät gilt als online, solange mindestens EINES
  // der beiden Signale aktuell ist -- das behebt sowohl das "17 von 19"-Problem
  // (Presence hatte den Schüler fälschlich fallen gelassen, der Heartbeat hält
  // ihn) als auch die zeitverzögerte Anzeige (der Heartbeat/Poll ist Sekunden
  // statt Minuten aktuell). Neu beigetretene Geräte, die Presence schon meldet,
  // die DB-Teilnehmerliste (Debounce/Poll) aber noch nicht kennt, sind über den
  // presentKeys-Zweig sofort dabei.
  const connectedStudents = useMemo(() => {
    const freshSince = nowTs - ONLINE_THRESHOLD_MS;
    const online = new Set(presentKeys);
    for (const p of participants) {
      if (p.lastSeenAt && new Date(p.lastSeenAt).getTime() >= freshSince) {
        online.add(p.studentKey);
      }
    }
    return [...online];
  }, [presentKeys, participants, nowTs]);

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
  const refreshStudentsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Station mode RAM state
  const [stationStates, setStationStates] = useState<Map<number, StationStudentState>>(new Map());
  const stationStatesRef = useRef<Map<number, StationStudentState>>(new Map());

  useEffect(() => {
    stationStatesRef.current = stationStates;
  }, [stationStates]);

  const applyAuthoritativeStudents = (students: RoomStudentRow[]) => {
    const currentStudents = sessionIdRef.current
      ? students.filter((student) => student.sessionId === sessionIdRef.current)
      : students;
    setResults(resultsFromStudents(currentStudents));
    setStationStates(stationStatesFromStudents(currentStudents));
    setStudentsInLobby((prev) => {
      const next = [...prev];
      for (const key of currentStudents.map((s) => s.studentKey)) {
        if (!next.includes(key)) next.push(key);
      }
      return next;
    });
    setLiveProgress((prev) => ({
      ...prev,
      ...Object.fromEntries(currentStudents.map((s) => [s.studentKey, s.currentIndex])),
    }));
  };

  const refreshAuthoritativeStudents = async (): Promise<RoomStudentRow[]> => {
    if (!roomIdRef.current || !accessTokenRef.current) return [];
    const students = await getRoomStudents(roomIdRef.current, accessTokenRef.current);
    applyAuthoritativeStudents(students);
    return students;
  };

  const refreshParticipants = async (): Promise<void> => {
    if (!roomIdRef.current || !accessTokenRef.current) return;
    const rows = await getRoomParticipants(roomIdRef.current, accessTokenRef.current);
    // Immer eine neue Array-Referenz -- so wertet der connectedStudents-useMemo
    // die last_seen_at-Frische bei jedem Poll gegen die aktuelle Uhrzeit neu aus.
    setParticipants(rows);
  };

  // Wie scheduleAuthoritativeRefresh unten, aber für die Teilnehmerliste:
  // während der Beitrittswelle (18 Geräte nacheinander) feuert Presence-sync
  // pro Beitritt einmal -- ohne Debounce wären das 18 einzelne DB-Abfragen.
  const refreshParticipantsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleParticipantsRefresh = () => {
    if (refreshParticipantsTimerRef.current) clearTimeout(refreshParticipantsTimerRef.current);
    refreshParticipantsTimerRef.current = setTimeout(() => {
      refreshParticipants().catch((err) => {
        logDevError('[Room] Abgleich der Teilnehmerliste fehlgeschlagen', err);
      });
    }, 300);
  };

  /**
   * Entfernt einen (länger inaktiven) Teilnehmer samt Fortschritt aus dem
   * Raum -- Lobby-Aktion auf den ausgegrauten Karten. Erst nach erfolgreichem
   * DB-Delete verschwindet er auch aus allen lokalen Listen.
   */
  const handleRemoveStudent = async (studentKey: string) => {
    if (!roomIdRef.current || !accessTokenRef.current) return;
    try {
      await removeRoomParticipant(roomIdRef.current, accessTokenRef.current, studentKey);
    } catch (err) {
      logDevError('[Room] Entfernen des Teilnehmers fehlgeschlagen', err);
      alert('Der Schüler konnte nicht entfernt werden. Bitte Internetverbindung prüfen und erneut versuchen.');
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.studentKey !== studentKey));
    setPresentKeys((prev) => {
      if (!prev.has(studentKey)) return prev;
      const next = new Set(prev);
      next.delete(studentKey);
      return next;
    });
    setStudentsInLobby((prev) => prev.filter((name) => name !== studentKey));
    setStudentVersions((prev) => {
      const next = { ...prev };
      delete next[studentKey];
      return next;
    });
    setLiveProgress((prev) => {
      const next = { ...prev };
      delete next[studentKey];
      return next;
    });
  };

  // Broadcasts dienen nur als schneller Aenderungshinweis. Der Inhalt selbst
  // wird nicht vertraut; nach kurzem Debounce lesen wir den tokengebundenen
  // Datenbankstand. So erzeugt ein gefaelschtes Broadcast keine Fake-Ergebnisse.
  const scheduleAuthoritativeRefresh = () => {
    if (refreshStudentsTimerRef.current) clearTimeout(refreshStudentsTimerRef.current);
    refreshStudentsTimerRef.current = setTimeout(() => {
      refreshAuthoritativeStudents().catch((err) => {
        logDevError('[Room] Autoritativer Ergebnisabgleich fehlgeschlagen', err);
      });
    }, 300);
  };

  useEffect(() => () => {
    if (refreshStudentsTimerRef.current) clearTimeout(refreshStudentsTimerRef.current);
    if (refreshParticipantsTimerRef.current) clearTimeout(refreshParticipantsTimerRef.current);
  }, []);

  // Lehrergerät wacht aus dem Standby auf / Tab kommt zurück in den
  // Vordergrund (z. B. iPad am Beamer): Verbindung sofort anstoßen statt auf
  // den Auto-Reconnect-Backoff zu warten, und den autoritativen Stand
  // (Ergebnisse + Teilnehmerliste) nachziehen -- Broadcasts, die während des
  // Standbys verpasst wurden, kommen nicht nach. Gegenstück zur gleichen
  // Logik auf der Schülerseite (useGameRoom.ts).
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!channelRef.current) return;
      if (channelRef.current.state !== 'joined') {
        supabase.realtime.connect();
      }
      scheduleAuthoritativeRefresh();
      scheduleParticipantsRefresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // Die schedule*-Funktionen arbeiten ausschließlich über Refs -- die beim
    // Mount eingefangenen Instanzen bleiben dauerhaft gültig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodischer, presence-unabhängiger Abgleich, solange ein Raum offen ist
  // (roomCode gesetzt). Presence liefert zwar sofortige Beitritts-/Verlassen-
  // Events, bemerkt einen echten Abbruch aber erst nach 30-90s -- und ein
  // einzelnes ausbleibendes Presence-Event würde die "N verbunden"-Anzeige
  // sonst dauerhaft falsch stehen lassen. Dieser Poll macht die
  // Teilnehmerliste (samt last_seen_at) zur DB-Wahrheit und hält sie auf
  // wenige Sekunden aktuell; zusammen mit dem Heartbeat (connectedStudents)
  // ist das die eigentliche Kur gegen die zeitverzögerte Synchronisation. Die
  // Ergebnisse werden gleich mitgezogen, damit auch der Live-Fortschritt nicht
  // an einem verpassten Broadcast hängen bleibt.
  useEffect(() => {
    if (!roomCode) return;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      // "Jetzt" vorrücken, damit die last_seen_at-Frische im Takt des Polls neu
      // gegen die Uhr bewertet wird (auch wenn die Teilnehmerliste sich inhaltlich
      // nicht ändert -- ein Schüler, der aufhört zu heartbeaten, graut so aus).
      setNowTs(Date.now());
      refreshParticipants().catch((err) => logDevError('[Room] Teilnehmer-Poll fehlgeschlagen', err));
      refreshAuthoritativeStudents().catch((err) => logDevError('[Room] Ergebnis-Poll fehlgeschlagen', err));
    };
    const intervalId = setInterval(poll, PARTICIPANTS_POLL_MS);
    const onVisible = () => poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // refreshParticipants/refreshAuthoritativeStudents arbeiten über Refs; nur
    // der roomCode (Raum offen/geschlossen) steuert Start und Stopp des Polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Baut den Realtime-Channel für einen Code auf (Listener, keine
  // Subscribe-Reaktion – die unterscheidet sich zwischen echtem Lobby-Öffnen
  // und der Wiederherstellung nach einem Reload, siehe unten). Extrahiert
  // aus handleOpenLobby, damit beide Pfade exakt dieselben Listener bekommen.
  const attachChannel = async (code: string) => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`room-${code}`);
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
      setPresentKeys(new Set(keys));
      if (keys.length >= 1) setHadTwoConnections(true);
      // Jede Presence-Änderung kann einen neuen DB-Teilnehmer bedeuten --
      // die registrierte Liste (angemeldet vs. verbunden) nachziehen.
      scheduleParticipantsRefresh();

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

    channel.on('broadcast', { event: 'student-finished' }, () => {
      scheduleAuthoritativeRefresh();
    });

    // Live-Fortschritt der Schüler mitschreiben (für die Schüler-Übersicht).
    channel.on('broadcast', { event: 'student-progress' }, (payload) => {
      const { index } = payload.payload;
      if (typeof index === 'number') scheduleAuthoritativeRefresh();
    });

    // Station mode listeners
    channel.on('broadcast', { event: 'request-station-state' }, (payload) => {
      const { studentNumber } = payload.payload;
      const current = stationStatesRef.current.get(studentNumber);
      if (current) {
          channel.send({ type: 'broadcast', event: 'sync-station-state', payload: { studentNumber } });
        return;
      }
      // RAM-Map hat (noch) nichts -- z. B. weil das Dashboard zwischenzeitlich
      // neu geladen wurde (siehe restoreDashboardSession unten). Fallback auf
      // die DB, bevor wir dem Tablet einfach einen leeren Stand zurückgeben.
      refreshAuthoritativeStudents()
        .then(() => {
          channel.send({ type: 'broadcast', event: 'sync-station-state', payload: { studentNumber } });
        })
        .catch((err) => {
          // Anders als oben: hier ist unbekannt, ob schon Fortschritt existiert
          // (die Abfrage selbst ist fehlgeschlagen, kein bestaetigtes "leer").
          // Bewusst NICHTS senden statt einen erfundenen Nullstand zu
          // bestaetigen -- das Tablet behaelt seinen eigenen (bereits optimistisch
          // auf 0 gesetzten) lokalen Stand, statt dass wir aktiv vorhandenen
          // Fortschritt vortaeuschen zu haben geloescht.
          logDevError('[Room] Stationswiederherstellung fehlgeschlagen', err);
        });
    });

    channel.on('broadcast', { event: 'update-station-state' }, (payload) => {
      const { studentNumber } = payload.payload;
      if (typeof studentNumber === 'number') scheduleAuthoritativeRefresh();
    });

    return channel;
  };

  // Nach einem Reload des Dashboard-Tabs mitten in einer laufenden Sitzung
  // war der Raum bisher komplett verloren (roomIdRef/accessTokenRef leben
  // nur im Hook, der Zustand-Store wird von React/Vite ohnehin frisch
  // initialisiert). Einmal beim Mount versuchen, eine zuvor gespeicherte
  // Sitzung (siehe dashboardRoomSession.ts) wiederherzustellen.
  useEffect(() => {
    const saved = readDashboardRoomSession();
    if (!saved) return;

    (async () => {
      let room;
      try {
        room = await getRoomState(saved.roomId, { accessToken: saved.accessToken });
      } catch (err) {
        logDevError('[Room] Raumwiederherstellung nach Reload fehlgeschlagen', err);
        clearDashboardRoomSession();
        return;
      }
      if (!room || room.status === 'ended') {
        // Raum existiert nicht mehr oder wurde inzwischen beendet -> nichts
        // wiederherzustellen, frisch bei IMPORT starten (Ausgangszustand).
        clearDashboardRoomSession();
        return;
      }

      roomIdRef.current = saved.roomId;
      accessTokenRef.current = saved.accessToken;
      if (room.sessionId) sessionIdRef.current = room.sessionId;
      setRoomCode(saved.roomCode);
      hydrateStoreFromConfig(room.config);

      try {
        const students = await getRoomStudents(saved.roomId, saved.accessToken);
        applyAuthoritativeStudents(students);
      } catch (err) {
        // Nicht fatal -- der Raum selbst ist wiederhergestellt, nur die
        // Detail-Ergebnisse fehlen dann bis zum nächsten Broadcast.
        logDevError('[Room] Wiederherstellung der Ergebnisdaten fehlgeschlagen', err);
      }
      // Registrierte Teilnehmer direkt mitladen -- der nächste Presence-sync
      // käme sonst erst, wenn sich ein Verbindungszustand ändert.
      refreshParticipants().catch((err) => {
        logDevError('[Room] Wiederherstellung der Teilnehmerliste fehlgeschlagen', err);
      });

      const channel = await attachChannel(saved.roomCode);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionWarning(false);
          setCurrentStep(room.status === 'live' ? 'LIVE' : 'LOBBY');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionWarning(true);
        }
      });
    })();
    // Nur einmal beim Mount versuchen -- ein laufender Raum wird danach
    // ausschließlich über die Refs/den Channel weitergeführt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenLobby = async () => {
    if (wordsLength === 0) {
      alert('Bitte füge zuerst Wörter hinzu!');
      return;
    }
    setHadTwoConnections(false);
    setOpenLobbyError(null);
    setPresentKeys(new Set());
    setParticipants([]);

    // Raum in der DB anlegen (Kahoot-artige, kollisionssichere Code-Vergabe,
    // siehe open_room() in der Migration). Schlägt das fehl (Migration noch
    // nicht angewendet, Supabase nicht erreichbar), brechen wir hier bewusst
    // hart ab -- ohne echten Code+Token ergibt der restliche Ablauf keinen Sinn.
    let room;
    try {
      room = await openRoom({});
    } catch (err) {
      logDevError('[Room] Sicheres Oeffnen des Raums fehlgeschlagen', err);
      setOpenLobbyError(
        'Der Raum konnte nicht angelegt werden. Bitte Internetverbindung prüfen und erneut versuchen.'
      );
      return;
    }
    roomIdRef.current = room.roomId;
    accessTokenRef.current = room.accessToken;
    setRoomCode(room.code);
    saveDashboardRoomSession({ roomId: room.roomId, accessToken: room.accessToken, roomCode: room.code });

    const channel = await attachChannel(room.code);
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

    // Der tokengepruefte DB-Zustand ist die Sicherheitsquelle. Erst wenn er
    // erfolgreich auf "live" steht, wird das oeffentliche Realtime-Signal
    // verschickt. Andernfalls duerfte ein Broadcast die Sitzung nicht starten.
    try {
      await updateSession(roomIdRef.current, accessTokenRef.current, sessionIdRef.current, buildRoomConfig());
    } catch (err) {
      logDevError('[Room] Sicheres Starten der Sitzung fehlgeschlagen', err);
      alert('Die Sitzung konnte serverseitig nicht gestartet werden. Bitte Internetverbindung prüfen und erneut versuchen.');
      return;
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
        logDevError('[Room] Sicheres Beenden des Raums fehlgeschlagen', err);
        // Anders als beim Broadcast unten (der Raum ist für die Schüler so
        // oder so vorbei) ist das hier ein stiller DB-Fehler, den sonst
        // niemand bemerken würde -- der Lehrkraft sichtbar machen, auch wenn
        // die lokale Ansicht trotzdem zu IMPORT zurückkehrt.
        alert(
          'Der Raum konnte serverseitig nicht beendet werden. Bitte Internetverbindung prüfen und erneut versuchen.'
        );
        return;
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
    setPresentKeys(new Set());
    setParticipants([]);
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
    clearDashboardRoomSession();
  };

  return {
    roomCode,
    openLobbyError,
    results,
    studentsInLobby,
    connectedStudents,
    registeredStudents,
    studentVersions,
    hadTwoConnections,
    connectionWarning,
    liveProgress,
    stationStates,
    handleOpenLobby,
    handleStartSession,
    handleEndSession,
    handleRemoveStudent,
  };
};
