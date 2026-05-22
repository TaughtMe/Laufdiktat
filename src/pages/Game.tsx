import React, { useState, useEffect, useRef } from 'react';
import type { GameState, GameMetrics } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { StationGame } from './StationGame';

interface InkSplat {
  id: number;
  top: string;
  left: string;
  width: string;
  height: string;
  borderRadius: string;
  rotation: number;
}

export const Game = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const roomCode = location.state?.roomCode as string | undefined;
  const studentName = location.state?.studentName as string | undefined;

  const words = useGameStore((state) => state.words);
  const setWords = useGameStore((state) => state.setWords);
  const battleOptions = useGameStore((state) => state.battleOptions);
  const setBattleOptions = useGameStore((state) => state.setBattleOptions);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const bimanualLocked = useGameStore((state) => state.bimanualLocked);
  const setBimanualLocked = useGameStore((state) => state.setBimanualLocked);
  const stationMode = useGameStore((state) => state.stationMode);
  const setStationMode = useGameStore((state) => state.setStationMode);
  const setStationCount = useGameStore((state) => state.setStationCount);
  const isTtsEnabled = useGameStore((state) => state.isTtsEnabled);
  const setTtsEnabled = useGameStore((state) => state.setTtsEnabled);
  
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [metrics, setMetrics] = useState<GameMetrics>({ peeks: 0, attempts: 0 });
  const [errorShake, setErrorShake] = useState(false);
  const [showScaffolding, setShowScaffolding] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState(false);

  // Lokale Interferenz-States
  const [inkSplats, setInkSplats] = useState<InkSplat[]>([]);
  const [forceFlicker, setForceFlicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Derived state that needs to be calculated before effects
  const totalLength = words.reduce((acc, word) => acc + word.targetWord.length, 0);
  const efficiencyIndex = totalLength / (Math.max(1, metrics.peeks) * Math.max(1, metrics.attempts));
  const currentWord = words[currentWordIndex] || { targetWord: '' };
  
  const generateInkSplat = (): InkSplat => {
    return {
      id: Math.random(),
      top: `${Math.random() * 40 + 30}%`,
      left: `${Math.random() * 60 + 20}%`,
      width: `${Math.random() * 80 + 80}px`,
      height: `${Math.random() * 60 + 60}px`,
      borderRadius: `${Math.random() * 30 + 40}% ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 30}% / ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 60}% ${Math.random() * 30 + 40}%`,
      rotation: Math.random() * 360
    };
  };

  useEffect(() => {
    if (!roomCode) return;
    
    const channelName = `room-${roomCode}`;
    const channel = supabase.channel(channelName);
    
    channel.on(
      'broadcast',
      { event: 'session-start' },
      (payload) => {
        const { words: newWords, gameMode: newMode, battleOptions: newOptions, stationMode: newStationMode, stationCount: newStationCount, isTtsEnabled: newTtsEnabled } = payload.payload;
        setWords(newWords);
        setGameMode(newMode);
        setBattleOptions(newOptions);
        if (newStationMode !== undefined) setStationMode(newStationMode);
        if (newStationCount !== undefined) setStationCount(newStationCount);
        if (newTtsEnabled !== undefined) setTtsEnabled(newTtsEnabled);
      }
    ).on(
      'broadcast',
      { event: 'session-ended' },
      () => {
        navigate('/');
      }
    ).subscribe(async (status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionWarning(true);
      } else if (status === 'SUBSCRIBED') {
        setConnectionWarning(false);
        if (studentName) {
          await channel.send({
            type: 'broadcast',
            event: 'student-joined',
            payload: { name: studentName }
          });
        }
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, studentName, setWords, setGameMode, setBattleOptions]);

  useEffect(() => {
    if (bimanualLocked) {
      inputRef.current?.blur();
    } else if (gameState === 'WRITING') {
      const timer = setTimeout(() => inputRef.current?.focus(), 10);
      
      // Ink Logik (30% Wahrscheinlichkeit)
      if (battleOptions.ink && Math.random() < 0.3 && inkSplats.length === 0) {
        setInkSplats([generateInkSplat()]);
      }
      
      return () => clearTimeout(timer);
    }
    
    if (gameState !== 'WRITING') {
      setInkSplats([]);
    }
  }, [bimanualLocked, gameState, battleOptions.ink]);

  useEffect(() => {
    if (gameState === 'FINISHED' && roomCode) {
      const channel = supabase.channel(`room-${roomCode}`);
      channel.send({
        type: 'broadcast',
        event: 'student-finished',
        payload: {
          name: studentName,
          score: efficiencyIndex,
          peeks: metrics.peeks,
          attempts: metrics.attempts
        }
      });
    }
  }, [gameState, roomCode, studentName, efficiencyIndex, metrics.peeks, metrics.attempts]);

  // Station mode: delegate to separate component (AFTER all hooks)
  if (stationMode) return <StationGame />;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState === 'FINISHED' || words.length === 0) return;
    
    if (e.touches.length >= 2) {
      if (!bimanualLocked) {
        setMetrics((prev) => ({ ...prev, peeks: prev.peeks + 1 }));
        setBimanualLocked(true);
        setGameState('REVEALED');
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (gameState === 'FINISHED' || words.length === 0) return;
    
    if (e.touches.length < 2) {
      if (bimanualLocked) {
        setBimanualLocked(false);
        setGameState('WRITING');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameState !== 'WRITING' || words.length === 0) return;

    setMetrics((prev) => ({ ...prev, attempts: prev.attempts + 1 }));

    if (inputValue.trim() === currentWord.targetWord) {
      if (currentWordIndex + 1 < words.length) {
        setCurrentWordIndex((prev) => prev + 1);
        setInputValue('');
        setGameState('IDLE');
      } else {
        setGameState('FINISHED');
      }
    } else {
      setInputValue('');
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      
      if (gameMode === 'UEBUNG') {
        setShowScaffolding(true);
        setTimeout(() => setShowScaffolding(false), 1500);
      }
      
      inputRef.current?.focus();
    }
  };

  const isFlickerActive = (battleOptions.flicker || forceFlicker) && bimanualLocked;

  // Fallback: Empty State
  if (words.length === 0) {
    if (roomCode) {
      return (
        <div className="flex flex-col min-h-[100dvh] bg-gradient-to-b from-[#0a2a3c] via-[#0d3349] to-[#0a2a3c] items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white/10 text-center max-w-md w-full">
            <span className="text-6xl mb-4 block animate-bounce">⏳</span>
            <h2 className="text-2xl font-bold text-white mb-2">Warte auf Lehrer...</h2>
            <p className="text-slate-400 mb-6">
              Raum-Code: <span className="font-mono font-bold text-brand-400">{roomCode}</span>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-[100dvh] bg-gradient-to-b from-[#0a2a3c] via-[#0d3349] to-[#0a2a3c] items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white/10 text-center max-w-md w-full">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-white mb-2">Keine Wörter geladen</h2>
          <p className="text-slate-400 mb-6">
            Bitte importiere im Dashboard eine Wortliste, um das Laufdiktat zu starten.
          </p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            Zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col min-h-[100dvh] bg-gradient-to-b from-[#0a2a3c] via-[#0d3349] to-[#0a2a3c] select-none overflow-hidden touch-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {connectionWarning && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm font-medium z-50">
          Verbindung zum Server verloren. Ergebnisse können nicht synchronisiert werden.
        </div>
      )}
      <header className="py-4 px-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
            title="Spiel abbrechen und zur Startseite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">
            Wort {currentWordIndex + 1} von {words.length}
          </h1>
        </div>
        <div className="flex gap-4 text-sm font-semibold text-slate-400">
          <span>Spicker: {metrics.peeks}</span>
          <span>Fehler: {Math.max(0, metrics.attempts - currentWordIndex)}</span>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center p-4">
        {gameState !== 'FINISHED' && (
          <>
            {/* Haptische Barriere: Visuelle Indikatoren */}
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none ${bimanualLocked ? 'opacity-100' : 'opacity-20'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 transition-colors duration-300 ${bimanualLocked ? 'text-[#5efcc2]' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
              </svg>
            </div>
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none ${bimanualLocked ? 'opacity-100' : 'opacity-20'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 transition-colors duration-300 ${bimanualLocked ? 'text-[#5efcc2]' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
              </svg>
            </div>
          </>
        )}

        {/* Core Interaction Area */}
        <div className="z-10 w-full max-w-md flex flex-col items-center">
          {gameState === 'IDLE' && (
            <div className="text-center space-y-6 pointer-events-none max-w-sm px-6">
              <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                <span className="text-4xl">✋</span>
              </div>
              <p className="text-slate-300 font-bold text-lg sm:text-xl leading-relaxed">
                Mit zwei Fingern gleichzeitig
                die <span className="text-[#5efcc2] font-extrabold">Bildschirmränder</span>{' '}
                gedrückt halten, um das Wort
                zu sehen.
              </p>
            </div>
          )}

          {bimanualLocked && (
            <div className={`text-center transform transition-transform scale-110 pointer-events-none ${isFlickerActive ? 'animate-flicker' : ''} px-6`}>
              <div className="flex items-center justify-center gap-4">
                <h2 className="text-5xl sm:text-7xl font-black text-brand-500 dark:text-brand-400 tracking-tight drop-shadow-sm font-sans select-none">
                  {currentWord.targetWord}
                </h2>
                {gameMode === 'UEBUNG' && isTtsEnabled && (
                  <button
                    type="button"
                    className="pointer-events-auto bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 p-3 rounded-2xl shadow-sm border border-slate-100/80 dark:border-slate-700 transition-colors flex items-center justify-center cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const utterance = new SpeechSynthesisUtterance(currentWord.targetWord);
                      utterance.lang = 'de-DE';
                      window.speechSynthesis.speak(utterance);
                    }}
                    title="Wort vorlesen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-8 text-xs font-bold tracking-wider uppercase text-slate-400 bg-white/5 px-5 py-2.5 rounded-full inline-block border border-white/10 backdrop-blur-sm">
                Wort einprägen... Loslassen zum Tippen!
              </p>
            </div>
          )}

          {!bimanualLocked && gameState === 'WRITING' && (
            <form 
              onSubmit={handleSubmit} 
              className={`w-full transition-transform relative ${errorShake ? 'animate-shake' : ''} px-4`}
            >
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className={`w-full text-center text-4xl font-bold py-6 px-4 bg-white/10 backdrop-blur-sm border-4 ${
                    errorShake 
                      ? 'border-red-500 text-red-400' 
                      : 'border-brand-500 text-white focus:ring-brand-500/20'
                  } rounded-[1.8rem] shadow-[0_10px_35px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-4 transition-all relative z-10 font-sans tracking-wide placeholder:text-slate-500`}
                  placeholder="Wort eingeben..."
                  autoComplete="off"
                  spellCheck="false"
                  autoCorrect="off"
                />
                
                {/* Ink Splats Overlay */}
                {inkSplats.map(splat => (
                  <div
                    key={splat.id}
                    className="absolute bg-slate-950 dark:bg-black pointer-events-none z-20 blur-[1px] opacity-90 shadow-2xl"
                    style={{
                      top: splat.top,
                      left: splat.left,
                      width: splat.width,
                      height: splat.height,
                      borderRadius: splat.borderRadius,
                      transform: `translate(-50%, -50%) rotate(${splat.rotation}deg)`,
                    }}
                  />
                ))}
                
                {/* Visuelles Scaffolding (UEBUNG) */}
                {showScaffolding && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <span className="text-4xl font-bold text-slate-800 dark:text-white opacity-30 select-none">
                      {currentWord.targetWord}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-center mt-4 text-xs font-bold text-slate-500 uppercase tracking-wider pointer-events-none">
                Drücke Enter zum Bestätigen
              </p>
              <div className="mt-8 text-center relative z-30">
                <button
                  type="button"
                  onClick={() => setGameState('IDLE')}
                  className="text-xs font-bold tracking-wide uppercase text-slate-400 hover:text-[#5efcc2] transition-colors underline underline-offset-4 px-4 py-2 cursor-pointer"
                >
                  Wort nochmal ansehen
                </button>
              </div>
            </form>
          )}

          {gameState === 'FINISHED' && (
            <div className="text-center transform transition-transform scale-110 px-6 max-w-sm flex flex-col items-center">
              <span className="text-7xl mb-4 block animate-bounce">🏆</span>
              <h2 className="text-3.5xl font-black text-white tracking-tight leading-none">
                Geschafft!
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-[280px]">
                Du hast alle {words.length} Wörter erfolgreich absolviert.
              </p>
              
              <div className="mt-8 w-full">
                <div className="bg-white/10 backdrop-blur-sm px-6 py-5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] border border-white/10 flex flex-col items-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold mb-1">
                    Efficiency Index (EI)
                  </div>
                  <div className="text-4.5xl font-black text-brand-400">
                    {efficiencyIndex.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-4 w-full flex justify-between gap-3 text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl">
                <span>Spicker gesamt: {metrics.peeks}</span>
                <span>Fehler gesamt: {Math.max(0, metrics.attempts - words.length)}</span>
              </div>
              
              <div className="mt-8 w-full">
                <button
                  onClick={() => navigate('/')}
                  className="w-full px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer text-sm"
                >
                  Fertig
                </button>
              </div>
            </div>
          )}
        </div>
        {/* FOKUS-MODUS Badge */}
        {gameState !== 'FINISHED' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2"/><line x1="10" y1="15" x2="10" y2="9" strokeWidth="2"/><line x1="14" y1="15" x2="14" y2="9" strokeWidth="2"/></svg>
              Fokus-Modus aktiv
            </span>
          </div>
        )}
      </main>

      {/* Dev-Buttons Layer (nur sichtbar, wenn das Spiel läuft und BATTLE aktiv ist) */}
      {gameState !== 'FINISHED' && gameState !== 'IDLE' && words.length > 0 && gameMode === 'BATTLE' && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-50">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setForceFlicker(prev => !prev);
            }}
            className="text-xs bg-black/50 text-white px-3 py-1 rounded opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          >
            {forceFlicker ? 'Stop Flimmern' : 'Simuliere Flimmern'}
          </button>
          {gameState === 'WRITING' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setInkSplats(prev => [...prev, generateInkSplat()]);
              }}
              className="text-xs bg-black/50 text-white px-3 py-1 rounded opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
            >
              Simuliere Tinte
            </button>
          )}
        </div>
      )}
    </div>
  );
};

