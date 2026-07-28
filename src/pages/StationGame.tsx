import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';
import { ExitConfirm, SessionEndedOverlay } from '../components/game/GameOverlays';
import { useExitGuard } from '../hooks/game/useExitGuard';
import { LegalLink } from '../components/shared/LegalLink';
import { buildStationOrder } from '../utils/game/stationShuffle';
import { MathDisplay } from '../components/shared/MathDisplay';
import { useAutoFitFontSize } from '../hooks/game/useAutoFitFontSize';
import { upsertProgress, getRoomState, getMyProgress } from '../utils/rooms/roomApi';
import { useParticipantHeartbeat } from '../hooks/shared/useParticipantHeartbeat';
import { logDevError } from '../utils/shared/logging';

type StationView = 'GRID' | 'ACTIVE';

export const StationGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Einmalig festhalten (überlebt den popstate des Zurück-Guards).
  const [roomCode] = useState<string | undefined>(() => (location.state as { roomCode?: string } | null)?.roomCode);
  // Von Home.tsx (joinRoom) – für upsertProgress() unten (dauerhafte
  // Ablage, ergänzend zu den bestehenden Broadcasts).
  const [roomId] = useState<string | undefined>(() => (location.state as { roomId?: string } | null)?.roomId);
  const [participantToken] = useState<string | undefined>(
    () => (location.state as { participantToken?: string } | null)?.participantToken
  );
  const words = useGameStore((s) => s.words);
  const setWords = useGameStore((s) => s.setWords);
  const stationCount = useGameStore((s) => s.stationCount);
  const setStationCount = useGameStore((s) => s.setStationCount);
  const isTtsEnabled = useGameStore((s) => s.isTtsEnabled);
  const setTtsEnabled = useGameStore((s) => s.setTtsEnabled);
  const setStrictTypingMode = useGameStore((s) => s.setStrictTypingMode);
  const stationShuffle = useGameStore((s) => s.stationShuffle);
  const setStationShuffle = useGameStore((s) => s.setStationShuffle);
  // Kennung der laufenden Sitzung – Teil des Stations-Shuffle-Seeds (siehe
  // utils/game/stationShuffle.ts). Ephemer wie roomCode/studentName in Game.tsx.
  const [sessionId, setSessionId] = useState('');

  // Stations-Tablets haben einen eigenen Channel OHNE Presence -- ohne diesen
  // Heartbeat stünde ihr last_seen_at ab dem Rundenstart still und die DB-
  // Sicht meldete verbundene Tablets fälschlich als "offline" (useGameRoom
  // ist im Stationsmodus abgeschaltet, siehe Game.tsx).
  useParticipantHeartbeat(roomId, participantToken);

  const [view, setView] = useState<StationView>('GRID');
  const [studentNumber, setStudentNumber] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [peeks, setPeeks] = useState(0);
  const [bimanualLocked, setBimanualLocked] = useState(false);
  // Welche Wörter ein Schüler schon gesehen hat (Schlüssel "nummer:index").
  // Bleibt erhalten, solange das Gerät montiert ist – auch nach dem Zurückkehren
  // zur Übersicht. Steuert Spickenzähler (erstes Ansehen frei) und Weiter-Sperre.
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  // Einmal gesetzt (letztes Wort zum ersten Mal angesehen), bleibt stehen –
  // auch wenn danach zurückgeblättert wird (siehe StationStudentState).
  const [finished, setFinished] = useState(false);
  const [showFinishedToast, setShowFinishedToast] = useState(false);
  // Wird beim (Wieder-)Wählen einer Nummer gesetzt, solange der gespeicherte
  // Stand aus der DB geladen wird – verhindert, dass kurz "Wort 1" aufblitzt.
  const [isRestoring, setIsRestoring] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Einmaliger DB-Fallback pro Mount (siehe useGameRoom.ts, gleiches Prinzip):
  // fängt eine Sitzung ab, die schon lief, bevor dieses Tablet beigetreten ist
  // (oder das session-start-Broadcast verpasst wurde) -- ohne das blieb ein
  // Stationen-Tablet sonst dauerhaft auf "Warte auf Lehrer" hängen.
  const hasFetchedRoomStateRef = useRef(false);
  // Aktuelle Nummer/Sitzung zusätzlich als Ref, damit der Realtime-Kanal EINMAL
  // aufgebaut bleibt (statt bei jeder Nummernwahl neu abonniert zu werden) und die
  // Handler trotzdem den frischen Wert sehen. Behebt das Re-Subscribe-Rennen, das
  // die Wiederherstellung des Fortschritts verschluckte.
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  // Weitester bereits erreichter Wortindex dieser Sitzung. Der gespeicherte Stand
  // darf nie darunter fallen (Monotonie) – so kann eine Neuauswahl derselben
  // Nummer (auch auf einem anderen Gerät) vorhandenen Fortschritt nicht auf 0
  // zurücksetzen. Lokales Zurückblättern bleibt davon unberührt.
  const reachedIndexRef = useRef(0);

  const seenKey = studentNumber !== null ? `${studentNumber}:${currentIndex}` : '';
  const hasSeenCurrent = seenKey !== '' && seenKeys.has(seenKey);

  useEffect(() => {
    if (!roomCode || !roomId || !participantToken) return;
    hasFetchedRoomStateRef.current = false;
    const syncAuthoritativeRoomState = async () => {
      try {
        const room = await getRoomState(roomId, { participantToken });
        hasFetchedRoomStateRef.current = true;
        if (room?.status === 'live') {
          const config = room.config as Record<string, unknown>;
          if (Array.isArray(config.words)) setWords(config.words as typeof words);
          if (typeof config.stationCount === 'number') setStationCount(config.stationCount);
          if (typeof config.isTtsEnabled === 'boolean') setTtsEnabled(config.isTtsEnabled);
          if (typeof config.strictTypingMode === 'boolean') setStrictTypingMode(config.strictTypingMode);
          if (typeof config.stationShuffle === 'boolean') setStationShuffle(config.stationShuffle);
          if (room.sessionId && room.sessionId !== sessionIdRef.current) {
            setSessionId(room.sessionId);
            setView('GRID');
            setStudentNumber(null);
          }
          setSessionEnded(false);
        } else if (room?.status === 'ended') {
          setSessionEnded(true);
        }
      } catch (err) {
        logDevError('[Room] Autoritativer Stationsabgleich fehlgeschlagen', err);
      }
    };
    channelRef.current = supabase.channel(`room-${roomCode}`);
    // Kein Broadcast-basiertes Wiederherstellen des Fortschritts mehr: Der Stand
    // wird beim Wählen einer Nummer direkt aus der DB geladen (handleSelectNumber).
    // Dadurch kann eine Fremdauswahl derselben Nummer diesen Bildschirm nicht mehr
    // auf ein anderes Wort "ziehen" (früher: sync-station-state → getMyProgress).
    channelRef.current.on('broadcast', { event: 'session-start' }, () => {
      void syncAuthoritativeRoomState();
    }).on('broadcast', { event: 'session-ended' }, () => {
      void syncAuthoritativeRoomState();
    });
    channelRef.current.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED' || hasFetchedRoomStateRef.current) return;
      await syncAuthoritativeRoomState();
    });
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
    // Bewusst OHNE studentNumber/sessionId: der Kanal bleibt über die ganze
    // Sitzung bestehen; frische Werte kommen über sessionIdRef bzw. direkt beim
    // Nummernwechsel.
  }, [roomCode, roomId, participantToken, setWords, setStationCount, setTtsEnabled, setStrictTypingMode, setStationShuffle, navigate]);

  const sendUpdate = useCallback((idx: number, p: number, isFinished: boolean) => {
    if (!channelRef.current || !studentNumber || !roomId || !participantToken || !sessionId) return;
    upsertProgress({
        roomId,
        sessionId,
        participantToken,
        studentKey: `station-${studentNumber}`,
        stationNumber: studentNumber,
        // Nie unter den weitesten erreichten Stand schreiben (Monotonie). So kann
        // weder Zurückblättern noch eine Fremdauswahl der Nummer den gespeicherten
        // Fortschritt senken. Die lokale Anzeige (currentIndex) bleibt frei.
        currentIndex: Math.max(idx, reachedIndexRef.current),
        peeks: p,
        attempts: 0,
        errors: 0,
        finished: isFinished,
      })
      .then(() => channelRef.current?.send({
        type: 'broadcast',
        event: 'update-station-state',
        payload: { studentNumber },
      }))
      .catch((err) => logDevError('[Room] Sicheres Stationsupdate fehlgeschlagen', err));
  }, [studentNumber, roomId, participantToken, sessionId]);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setView('GRID');
      setStudentNumber(null);
      setCurrentIndex(0);
      setPeeks(0);
      setBimanualLocked(false);
    }, 3000);
  }, []);

  const handleSelectNumber = async (num: number) => {
    setStudentNumber(num);
    setCurrentIndex(0);
    setPeeks(0);
    setFinished(false);
    setView('ACTIVE');
    // Fortschritt direkt und tokengebunden aus der DB laden, statt auf einen
    // flatterigen Broadcast-Rundlauf zu warten. So steigt der Schüler zuverlässig
    // am weitesten erreichten Wort wieder ein und nicht versehentlich bei Wort 1.
    reachedIndexRef.current = 0;
    if (roomId && sessionId && participantToken) {
      setIsRestoring(true);
      try {
        const progress = await getMyProgress(roomId, sessionId, participantToken, `station-${num}`);
        if (progress) {
          setCurrentIndex(progress.currentIndex);
          setPeeks(progress.peeks);
          setFinished(progress.finished);
          reachedIndexRef.current = progress.currentIndex;
        }
      } catch (err) {
        logDevError('[Room] Stationsfortschritt laden fehlgeschlagen', err);
      } finally {
        setIsRestoring(false);
      }
    }
    resetTimeout();
  };

  const handlePrev = () => {
    if (currentIndex <= 0) return;
    const next = currentIndex - 1;
    setCurrentIndex(next);
    sendUpdate(next, peeks, finished);
    resetTimeout();
  };

  const handleNext = () => {
    if (currentIndex >= words.length - 1) return;
    // Erst weiterblättern, wenn das aktuelle Wort einmal gesehen wurde.
    if (!hasSeenCurrent) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    reachedIndexRef.current = Math.max(reachedIndexRef.current, next);
    sendUpdate(next, peeks, finished);
    resetTimeout();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2 && !bimanualLocked) {
      setBimanualLocked(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  // Erstes Ansehen eines Wortes: dauerhaft merken (schaltet Weiterblättern
  // frei) und, falls es das letzte Wort ist, den Schüler als fertig markieren
  // – bleibt danach stehen, auch wenn er zurückblättert (siehe finished-State
  // oben). Zeigt zusätzlich kurz einen Hinweis-Toast.
  const markFirstSeen = () => {
    setSeenKeys((prev) => new Set(prev).add(seenKey));
    if (currentIndex === words.length - 1 && !finished) {
      setFinished(true);
      setShowFinishedToast(true);
      if (finishedToastTimeoutRef.current) clearTimeout(finishedToastTimeoutRef.current);
      finishedToastTimeoutRef.current = setTimeout(() => setShowFinishedToast(false), 4000);
      sendUpdate(currentIndex, peeks, true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2 && bimanualLocked) {
      setBimanualLocked(false);
      if (hasSeenCurrent) {
        // Wiederholtes Ansehen desselben Wortes zählt als Spicker.
        const newPeeks = peeks + 1;
        setPeeks(newPeeks);
        sendUpdate(currentIndex, newPeeks, finished);
      } else if (seenKey) {
        markFirstSeen();
      }
      resetTimeout();
    }
  };

  // Reihenfolge pro Schülernummer, nicht pro Gerät: gleiche Nummer + gleiche
  // Sitzung ergibt überall dieselbe Reihenfolge (siehe utils/game/stationShuffle.ts).
  const orderedWords = useMemo(
    () =>
      stationShuffle && studentNumber !== null && sessionId && roomCode
        ? buildStationOrder(words, roomCode, sessionId, studentNumber)
        : words,
    [stationShuffle, studentNumber, sessionId, roomCode, words]
  );

  const currentItem = orderedWords[currentIndex];
  const currentWord = currentItem?.prompt ?? currentItem?.targetWord ?? '';
  const { containerRef: revealContainerRef, textRef: revealTextRef, fontSize: revealFontSize } =
    useAutoFitFontSize(currentWord, { min: 28, max: 72 });

  // Wort vorlesen – wird wie ein Blick behandelt (erstes Mal frei, dann Spicker)
  // und schaltet das Weiterblättern frei.
  const speakWord = () => {
    if (!currentWord) return;
    const u = new SpeechSynthesisUtterance(currentWord);
    u.lang = 'de-DE';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    if (hasSeenCurrent) {
      const newPeeks = peeks + 1;
      setPeeks(newPeeks);
      sendUpdate(currentIndex, newPeeks, finished);
    } else if (seenKey) {
      markFirstSeen();
    }
    resetTimeout();
  };

  // Geräte-/Browser-Zurück abfangen, solange die Station läuft.
  const requestExit = useCallback(() => setShowExitConfirm(true), []);
  useExitGuard(!sessionEnded && !!roomCode, requestExit);

  // Lehrkraft hat die Sitzung beendet → Hinweis mit Zurück-Button.
  if (sessionEnded) return <SessionEndedOverlay onBack={() => navigate('/')} />;

  if (!roomCode || words.length === 0) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-brand-bg dark:bg-slate-950 items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-100/50 dark:border-slate-800 text-center max-w-md w-full">
          <span className="text-6xl mb-4 block animate-bounce">⏳</span>
          <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white mb-2">Warte auf Lehrer...</h2>
          {roomCode && (
            <p className="text-slate-550 dark:text-slate-400 font-medium">
              Raum-Code: <span className="font-mono font-bold text-brand-500">{roomCode}</span>
            </p>
          )}
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <LegalLink />
        </div>
      </div>
    );
  }

  // Number Grid View
  if (view === 'GRID') {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-brand-bg dark:bg-slate-950 select-none">
        <header className="py-4 px-6 border-b border-slate-150/60 dark:border-slate-900 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex justify-between items-center shadow-[0_2px_15px_rgba(0,0,0,0.01)]">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer"
            title="Zurück zur Startseite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-darkteal-800 dark:text-white">Wähle deine Nummer</h1>
          <div className="w-9" />
        </header>
        {showExitConfirm && (
          <ExitConfirm onConfirm={() => navigate('/')} onCancel={() => setShowExitConfirm(false)} />
        )}
        <main className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
          <p className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-6 text-center">
            Wähle deine zugewiesene Nummer, um an dieser Station zu starten.
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-4 w-full">
            {Array.from({ length: stationCount }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => handleSelectNumber(num)}
                className="aspect-square rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 shadow-[0_4px_12px_rgba(0,0,0,0.01)] hover:shadow-md text-3.5xl font-black text-darkteal-800 dark:text-slate-200 hover:text-brand-500 dark:hover:text-brand-450 transition-all active:scale-95 duration-150 cursor-pointer flex items-center justify-center"
              >
                {num}
              </button>
            ))}
          </div>
        </main>
        <footer className="py-4 text-center">
          <LegalLink />
        </footer>
      </div>
    );
  }

  // Active Station View
  return (
    <div
      className="flex flex-col h-[100dvh] bg-brand-bg dark:bg-slate-950 select-none overflow-hidden touch-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Header ist Teil des festen Flex-Layouts (shrink-0) – überdeckt dadurch
          nie die Textfläche darunter. Vorlesen lebt hier statt über dem Text. */}
      <header className="py-4 px-6 border-b border-slate-150/60 dark:border-slate-900 flex justify-between items-center gap-3 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-[0_2px_15px_rgba(0,0,0,0.01)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              setView('GRID');
              setStudentNumber(null);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer shrink-0"
            title="Zurück zur Nummernauswahl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-darkteal-800 dark:text-white truncate">
            Nr. {studentNumber} — {currentItem?.prompt ? 'Aufgabe' : 'Wort'} {isRestoring ? '…' : `${currentIndex + 1}/${words.length}`}
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isTtsEnabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); speakWord(); }}
              onTouchStart={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 transition-colors active:scale-95 cursor-pointer shrink-0"
              title="Vorlesen (zählt als Spicker)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <span className="bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 px-3 py-1.5 rounded-full border border-brand-100/50 text-xs font-bold whitespace-nowrap">
            Spicker: {peeks}
          </span>
        </div>
      </header>

      {/* Fertig-Hinweis: kurzer, nicht blockierender Toast – Navigation bleibt möglich. */}
      {showFinishedToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none bg-ok text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          🎉 Super, alle {currentItem?.prompt ? 'Aufgaben' : 'Sätze'} angesehen! Du kannst noch zurückblättern.
        </div>
      )}

      {/* Sichere Textfläche: flex-1 + min-h-0 sorgt dafür, dass dieser Bereich
          exakt den Platz zwischen Header und Footer füllt und nie darunter
          oder darüber hinausragt. */}
      <main className="flex-1 min-h-0 relative flex items-center justify-center p-4 overflow-hidden">
        {/* Dezente Randzonen: nur sichtbar, solange das Wort verborgen ist
            (bimanualLocked=false). Sobald aufgedeckt wird, blenden sie
            komplett aus – bleiben aber technisch aktiv (Touch-Erkennung
            hängt am äußeren Container). */}
        <div className={`absolute left-0 top-0 bottom-0 w-14 sm:w-16 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${bimanualLocked ? 'opacity-0' : 'opacity-25'}`}>
          <div className="w-1.5 h-24 rounded-full bg-brand-500" />
        </div>
        <div className={`absolute right-0 top-0 bottom-0 w-14 sm:w-16 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${bimanualLocked ? 'opacity-0' : 'opacity-25'}`}>
          <div className="w-1.5 h-24 rounded-full bg-brand-500" />
        </div>

        <div className="z-10 w-full max-w-md flex flex-col items-center">
          {isRestoring ? (
            <div className="text-center pointer-events-none">
              <p className="text-darkteal-800 dark:text-slate-300 font-bold text-base sm:text-lg">Lade Fortschritt…</p>
            </div>
          ) : bimanualLocked ? (
            <div
              ref={revealContainerRef}
              className="w-[92vw] max-w-2xl h-[38vh] max-h-[420px] flex items-center justify-center pointer-events-none"
            >
              <h2
                ref={revealTextRef}
                style={{ fontSize: `${revealFontSize}px` }}
                className="font-black text-brand-500 dark:text-brand-450 tracking-tight drop-shadow-sm font-sans select-none text-center leading-tight break-words"
              >
                <MathDisplay text={currentWord} isLatex={currentItem?.isLatex} />
              </h2>
            </div>
          ) : (
            <div className="text-center pointer-events-none max-w-xs px-6">
              <p className="text-darkteal-800 dark:text-slate-300 font-bold text-base sm:text-lg leading-relaxed">
                Mit zwei Fingern an den Bildschirmrändern halten, um {currentItem?.prompt ? 'die Aufgabe' : 'das Wort'} zu sehen.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Navigation arrows */}
      <footer className="p-4 border-t border-slate-150/60 dark:border-slate-900 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col gap-2 z-10 shadow-[0_-2px_15px_rgba(0,0,0,0.01)]">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex <= 0}
            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-darkteal-800 dark:text-white rounded-2xl font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= words.length - 1 || !hasSeenCurrent}
            title={!hasSeenCurrent ? 'Sieh dir zuerst das Wort an' : undefined}
            className="flex-1 py-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-30 text-white rounded-2xl font-bold transition-all active:scale-95 cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="text-center">
          <LegalLink />
        </div>
      </footer>
      {showExitConfirm && (
        <ExitConfirm onConfirm={() => navigate('/')} onCancel={() => setShowExitConfirm(false)} />
      )}
    </div>
  );
};
