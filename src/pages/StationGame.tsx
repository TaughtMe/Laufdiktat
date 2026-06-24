import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';
import { ExitConfirm, SessionEndedOverlay } from '../components/GameOverlays';
import { useExitGuard } from '../hooks/useExitGuard';
import { LegalLink } from '../components/LegalLink';

type StationView = 'GRID' | 'ACTIVE';

export const StationGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Einmalig festhalten (überlebt den popstate des Zurück-Guards).
  const [roomCode] = useState<string | undefined>(() => (location.state as { roomCode?: string } | null)?.roomCode);
  const words = useGameStore((s) => s.words);
  const stationCount = useGameStore((s) => s.stationCount);
  const setStationCount = useGameStore((s) => s.setStationCount);
  const isTtsEnabled = useGameStore((s) => s.isTtsEnabled);
  const setTtsEnabled = useGameStore((s) => s.setTtsEnabled);

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const seenKey = studentNumber !== null ? `${studentNumber}:${currentIndex}` : '';
  const hasSeenCurrent = seenKey !== '' && seenKeys.has(seenKey);

  useEffect(() => {
    if (!roomCode) return;
    channelRef.current = supabase.channel(`room-${roomCode}`);
    channelRef.current.on('broadcast', { event: 'sync-station-state' }, (payload) => {
      const d = payload.payload;
      if (d.studentNumber === studentNumber) {
        setCurrentIndex(d.currentIndex);
        setPeeks(d.peeks);
      }
    }).on('broadcast', { event: 'session-start' }, (payload) => {
      const { stationCount: newStationCount, isTtsEnabled: newTts } = payload.payload;
      if (newStationCount !== undefined) {
        setStationCount(newStationCount);
      }
      if (newTts !== undefined) {
        setTtsEnabled(newTts);
      }
    }).on('broadcast', { event: 'session-ended' }, () => {
      setSessionEnded(true);
    });
    channelRef.current.subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [roomCode, studentNumber, setStationCount, setTtsEnabled, navigate]);

  const sendUpdate = useCallback((idx: number, p: number) => {
    if (!channelRef.current || !studentNumber) return;
    channelRef.current.send({ type: 'broadcast', event: 'update-station-state', payload: { studentNumber, currentIndex: idx, peeks: p } });
  }, [studentNumber]);

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

  const handleSelectNumber = (num: number) => {
    setStudentNumber(num);
    setCurrentIndex(0);
    setPeeks(0);
    setView('ACTIVE');
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'request-station-state', payload: { studentNumber: num } });
    }
    resetTimeout();
  };

  const handlePrev = () => {
    if (currentIndex <= 0) return;
    const next = currentIndex - 1;
    setCurrentIndex(next);
    sendUpdate(next, peeks);
    resetTimeout();
  };

  const handleNext = () => {
    if (currentIndex >= words.length - 1) return;
    // Erst weiterblättern, wenn das aktuelle Wort einmal gesehen wurde.
    if (!hasSeenCurrent) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    sendUpdate(next, peeks);
    resetTimeout();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2 && !bimanualLocked) {
      setBimanualLocked(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2 && bimanualLocked) {
      setBimanualLocked(false);
      if (hasSeenCurrent) {
        // Wiederholtes Ansehen desselben Wortes zählt als Spicker.
        const newPeeks = peeks + 1;
        setPeeks(newPeeks);
        sendUpdate(currentIndex, newPeeks);
      } else if (seenKey) {
        // Erstes Ansehen: dauerhaft merken (auch nach Zurückkehren),
        // schaltet das Weiterblättern frei, zählt aber nicht.
        setSeenKeys((prev) => new Set(prev).add(seenKey));
      }
      resetTimeout();
    }
  };

  const currentWord = words[currentIndex]?.targetWord || '';

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
      sendUpdate(currentIndex, newPeeks);
    } else if (seenKey) {
      setSeenKeys((prev) => new Set(prev).add(seenKey));
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
      className="flex flex-col min-h-[100dvh] bg-brand-bg dark:bg-slate-950 select-none overflow-hidden touch-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <header className="py-4 px-6 border-b border-slate-150/60 dark:border-slate-900 flex justify-between items-center z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-[0_2px_15px_rgba(0,0,0,0.01)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView('GRID');
              setStudentNumber(null);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer"
            title="Zurück zur Nummernauswahl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-darkteal-800 dark:text-white">
            Nr. {studentNumber} — Wort {currentIndex + 1}/{words.length}
          </h1>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <span className="bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 px-3 py-1.5 rounded-full border border-brand-100/50">
            Spicker: {peeks}
          </span>
        </div>
      </header>

      {/* Touch area indicators */}
      <main className="flex-1 relative flex items-center justify-center p-4">
        {/* Vorlesen-Button: oben, außerhalb des Doppel-Touch-Bereichs, zählt als Spicker */}
        {isTtsEnabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); speakWord(); }}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-sm font-bold px-4 py-2.5 rounded-full border border-brand-100/50 dark:border-brand-800/50 shadow-sm transition-colors active:scale-95 cursor-pointer"
            title="Wort vorlesen (zählt als Spicker)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
            <span>Vorlesen</span>
          </button>
        )}
        <div className={`absolute left-0 top-0 bottom-0 w-24 sm:w-32 flex items-center justify-center transition-all duration-300 pointer-events-none ${bimanualLocked ? 'opacity-100' : 'opacity-30'}`}>
          <div className={`w-16 h-24 sm:h-32 rounded-[2rem] border-4 border-dashed flex items-center justify-center transition-all duration-300 ${
            bimanualLocked
              ? 'border-[#5efcc2] bg-[#5efcc2]/10 scale-105 shadow-[0_0_20px_rgba(94,252,194,0.15)]'
              : 'border-slate-200 dark:border-slate-800'
          }`}>
            <span className={`text-3xl transition-transform duration-300 ${bimanualLocked ? 'scale-110' : ''}`}>👇</span>
          </div>
        </div>
        <div className={`absolute right-0 top-0 bottom-0 w-24 sm:w-32 flex items-center justify-center transition-all duration-300 pointer-events-none ${bimanualLocked ? 'opacity-100' : 'opacity-30'}`}>
          <div className={`w-16 h-24 sm:h-32 rounded-[2rem] border-4 border-dashed flex items-center justify-center transition-all duration-300 ${
            bimanualLocked
              ? 'border-[#5efcc2] bg-[#5efcc2]/10 scale-105 shadow-[0_0_20px_rgba(94,252,194,0.15)]'
              : 'border-slate-200 dark:border-slate-800'
          }`}>
            <span className={`text-3xl transition-transform duration-300 ${bimanualLocked ? 'scale-110' : ''}`}>👇</span>
          </div>
        </div>

        <div className="z-10 w-full max-w-md flex flex-col items-center">
          {bimanualLocked ? (
            <div className="text-center transform transition-transform scale-110 pointer-events-none px-6">
              <h2 className="text-5xl sm:text-7xl font-black text-brand-500 dark:text-brand-450 tracking-tight drop-shadow-sm font-sans select-none">
                {currentWord}
              </h2>
              <p className="mt-8 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 bg-[#f0f5fa] dark:bg-slate-805/80 px-5 py-2.5 rounded-full inline-block border border-slate-100/50 dark:border-slate-800">
                Wort einprägen... Loslassen zum Schreiben!
              </p>
            </div>
          ) : (
            <div className="text-center space-y-6 animate-pulse pointer-events-none max-w-sm px-6">
              <div className="w-24 h-24 mx-auto bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50 dark:border-slate-800">
                <span className="text-4xl">👆</span>
              </div>
              <p className="text-darkteal-800 dark:text-slate-300 font-extrabold text-lg sm:text-xl leading-relaxed">
                Mit zwei Fingern gleichzeitig die Bildschirmränder gedrückt halten, um das Wort zu sehen.
              </p>
              <p className="text-slate-550 dark:text-slate-400 font-medium text-sm mt-3">
                Präge dir das Wort ein und schreibe es danach auf dein Papier!
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

