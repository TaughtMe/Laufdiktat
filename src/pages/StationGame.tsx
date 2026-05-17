import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';

type StationView = 'GRID' | 'ACTIVE';

export const StationGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const roomCode = location.state?.roomCode as string | undefined;
  const words = useGameStore((s) => s.words);

  const [view, setView] = useState<StationView>('GRID');
  const [studentNumber, setStudentNumber] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [peeks, setPeeks] = useState(0);
  const [bimanualLocked, setBimanualLocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    channelRef.current = supabase.channel(`room-${roomCode}`);
    channelRef.current.on('broadcast', { event: 'sync-station-state' }, (payload) => {
      const d = payload.payload;
      if (d.studentNumber === studentNumber) {
        setCurrentIndex(d.currentIndex);
        setPeeks(d.peeks);
      }
    });
    channelRef.current.subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [roomCode, studentNumber]);

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
    }, 10000);
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
    const next = currentIndex + 1;
    setCurrentIndex(next);
    sendUpdate(next, peeks);
    resetTimeout();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 4 && !bimanualLocked) {
      setBimanualLocked(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 4 && bimanualLocked) {
      setBimanualLocked(false);
      const newPeeks = peeks + 1;
      setPeeks(newPeeks);
      sendUpdate(currentIndex, newPeeks);
      resetTimeout();
    }
  };

  const currentWord = words[currentIndex]?.targetWord || '';

  if (!roomCode || words.length === 0) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900 items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center max-w-md w-full">
          <span className="text-6xl mb-4 block animate-bounce">⏳</span>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Warte auf Lehrer...</h2>
          {roomCode && <p className="text-slate-600 dark:text-slate-400">Raum: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{roomCode}</span></p>}
        </div>
      </div>
    );
  }

  // Number Grid View
  if (view === 'GRID') {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900 select-none">
        <header className="py-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex justify-between items-center">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Wähle deine Nummer</h1>
          <div className="w-9" />
        </header>
        <main className="flex-1 p-4 sm:p-8 flex items-center justify-center">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 w-full max-w-lg">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => handleSelectNumber(num)}
                className="aspect-square rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-lg text-3xl font-black text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Active Station View
  return (
    <div
      className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900 select-none overflow-hidden touch-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <header className="py-4 px-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('GRID'); setStudentNumber(null); if (timeoutRef.current) clearTimeout(timeoutRef.current); }} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Nr. {studentNumber} — Wort {currentIndex + 1}/{words.length}</h1>
        </div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">👁 {peeks}</span>
      </header>

      {/* Touch area */}
      <main className="flex-1 relative flex items-center justify-center p-4">
        <div className={`absolute left-0 top-0 bottom-0 w-24 flex items-center justify-center transition-opacity pointer-events-none ${bimanualLocked ? 'opacity-100' : 'opacity-30'}`}>
          <div className="w-16 h-24 rounded-[2rem] border-4 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center"><span className="text-slate-300 dark:text-slate-700 text-3xl">👇</span></div>
        </div>
        <div className={`absolute right-0 top-0 bottom-0 w-24 flex items-center justify-center transition-opacity pointer-events-none ${bimanualLocked ? 'opacity-100' : 'opacity-30'}`}>
          <div className="w-16 h-24 rounded-[2rem] border-4 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center"><span className="text-slate-300 dark:text-slate-700 text-3xl">👇</span></div>
        </div>

        <div className="z-10 w-full max-w-md flex flex-col items-center">
          {bimanualLocked ? (
            <div className="text-center pointer-events-none">
              <h2 className="text-5xl sm:text-7xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">{currentWord}</h2>
              <p className="mt-8 text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full inline-block">Wort einprägen... Loslassen zum Schreiben!</p>
            </div>
          ) : (
            <div className="text-center space-y-4 animate-pulse pointer-events-none">
              <div className="w-20 h-20 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner"><span className="text-4xl">👆</span></div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg px-8">4 Finger gleichzeitig gedrückt halten, um das Wort zu sehen.</p>
            </div>
          )}
        </div>
      </main>

      {/* Navigation arrows */}
      <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-between gap-4 z-10">
        <button
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-800 dark:text-white rounded-xl font-bold text-2xl transition-all active:scale-95"
        >
          ←
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex >= words.length - 1}
          className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white rounded-xl font-bold text-2xl transition-all active:scale-95"
        >
          →
        </button>
      </footer>
    </div>
  );
};
