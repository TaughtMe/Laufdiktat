import React, { useState, useEffect, useRef } from 'react';
import type { GameState, GameMetrics } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

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

  const words = useGameStore((state) => state.words);
  const setWords = useGameStore((state) => state.setWords);
  const battleOptions = useGameStore((state) => state.battleOptions);
  const setBattleOptions = useGameStore((state) => state.setBattleOptions);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [metrics, setMetrics] = useState<GameMetrics>({ peeks: 0, attempts: 0 });
  const [errorShake, setErrorShake] = useState(false);
  const [showScaffolding, setShowScaffolding] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState(false);

  // Lokale Interferenz-States
  const [inkSplats, setInkSplats] = useState<InkSplat[]>([]);
  const [forceFlicker, setForceFlicker] = useState(false); // Für Dev-Button

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomCode) return;
    
    const channel = supabase.channel(roomCode);
    
    channel.on(
      'broadcast',
      { event: 'session-start' },
      (payload) => {
        const { words: newWords, gameMode: newMode, battleOptions: newOptions } = payload.payload;
        setWords(newWords);
        setGameMode(newMode);
        setBattleOptions(newOptions);
      }
    ).subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionWarning(true);
      } else if (status === 'SUBSCRIBED') {
        setConnectionWarning(false);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, setWords, setGameMode, setBattleOptions]);

  // Fallback: Empty State
  if (words.length === 0) {
    if (roomCode) {
      return (
        <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900 items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center max-w-md w-full">
            <span className="text-6xl mb-4 block animate-bounce">⏳</span>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Warte auf Lehrer...</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Raum-Code: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{roomCode}</span>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900 items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center max-w-md w-full">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Keine Wörter geladen</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Bitte importiere im Dashboard eine Wortliste, um das Laufdiktat zu starten.
          </p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentWordIndex];

  const generateInkSplat = (): InkSplat => {
    return {
      id: Math.random(),
      top: `${Math.random() * 40 + 30}%`, // 30% to 70% bounds
      left: `${Math.random() * 60 + 20}%`, // 20% to 80% bounds
      width: `${Math.random() * 80 + 80}px`,
      height: `${Math.random() * 60 + 60}px`,
      borderRadius: `${Math.random() * 30 + 40}% ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 30}% / ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 60}% ${Math.random() * 30 + 40}%`,
      rotation: Math.random() * 360
    };
  };

  useEffect(() => {
    if (gameState === 'WRITING') {
      const timer = setTimeout(() => inputRef.current?.focus(), 10);
      
      // Ink Logik (30% Wahrscheinlichkeit)
      if (battleOptions.ink && Math.random() < 0.3 && inkSplats.length === 0) {
        setInkSplats([generateInkSplat()]);
      }
      
      return () => clearTimeout(timer);
    } else {
      setInkSplats([]); // Tinte beim Peek oder IDLE wieder entfernen
    }
  }, [gameState, battleOptions.ink]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState === 'FINISHED') return;
    
    // Für Maus-Dev-Tests akzeptieren wir auch Klicks, im echten Einsatz Touch.
    const isMultiTouch = 'touches' in e ? e.touches.length >= 2 : e.button === 0;
    
    if (isMultiTouch && gameState !== 'REVEALED') {
      setGameState('REVEALED');
      setMetrics((prev) => ({ ...prev, peeks: prev.peeks + 1 }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState === 'FINISHED') return;
    
    const touchesRemaining = 'touches' in e ? e.touches.length : 0;
    
    if (touchesRemaining < 2 && gameState === 'REVEALED') {
      setGameState('WRITING');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameState !== 'WRITING') return;

    setMetrics((prev) => ({ ...prev, attempts: prev.attempts + 1 }));

    if (inputValue.trim().toLowerCase() === currentWord.targetWord.toLowerCase()) {
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

  // Berechnung Efficiency Index
  const totalLength = words.reduce((acc, word) => acc + word.targetWord.length, 0);
  const efficiencyIndex = totalLength / (Math.max(1, metrics.peeks) * Math.max(1, metrics.attempts));

  useEffect(() => {
    if (gameState === 'FINISHED' && roomCode) {
      const channel = supabase.channel(roomCode);
      channel.send({
        type: 'broadcast',
        event: 'student-finished',
        payload: {
          score: efficiencyIndex,
          peeks: metrics.peeks,
          attempts: metrics.attempts
        }
      });
    }
  }, [gameState, roomCode, efficiencyIndex, metrics.peeks, metrics.attempts]);

  const isFlickerActive = (battleOptions.flicker || forceFlicker) && gameState === 'REVEALED';

  return (
    <div 
      className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900 select-none overflow-hidden touch-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      // Fallback für Dev/Mouse
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
    >
      {connectionWarning && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm font-medium z-50">
          Verbindung zum Server verloren. Ergebnisse können nicht synchronisiert werden.
        </div>
      )}
      <header className="py-4 px-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="Spiel abbrechen und zur Startseite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Wort {currentWordIndex + 1} von {words.length}
          </h1>
        </div>
        <div className="flex gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          <span>Spicker: {metrics.peeks}</span>
          <span>Fehler: {Math.max(0, metrics.attempts - currentWordIndex)}</span>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center p-4">
        {gameState !== 'FINISHED' && (
          <>
            {/* Haptische Barriere: Visuelle Indikatoren */}
            <div className={`absolute left-0 top-0 bottom-0 w-24 sm:w-32 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${gameState === 'REVEALED' ? 'opacity-100' : 'opacity-30'}`}>
              <div className="w-16 h-24 sm:h-32 rounded-[2rem] border-4 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                <span className="text-slate-300 dark:text-slate-700 text-3xl">👇</span>
              </div>
            </div>
            <div className={`absolute right-0 top-0 bottom-0 w-24 sm:w-32 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${gameState === 'REVEALED' ? 'opacity-100' : 'opacity-30'}`}>
              <div className="w-16 h-24 sm:h-32 rounded-[2rem] border-4 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                <span className="text-slate-300 dark:text-slate-700 text-3xl">👇</span>
              </div>
            </div>
          </>
        )}

        {/* Core Interaction Area */}
        <div className="z-10 w-full max-w-md flex flex-col items-center">
          {gameState === 'IDLE' && (
            <div className="text-center space-y-4 animate-pulse pointer-events-none">
              <div className="w-20 h-20 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
                <span className="text-4xl">👆</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg px-8">
                Mit zwei Fingern gleichzeitig die Bildschirmränder gedrückt halten, um das Wort zu sehen.
              </p>
            </div>
          )}

          {gameState === 'REVEALED' && (
            <div className={`text-center transform transition-transform scale-110 pointer-events-none ${isFlickerActive ? 'animate-flicker' : ''}`}>
              <div className="flex items-center justify-center gap-4">
                <h2 className="text-5xl sm:text-7xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">
                  {currentWord.targetWord}
                </h2>
                {gameMode === 'UEBUNG' && (
                  <button
                    type="button"
                    className="pointer-events-auto bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 p-3 rounded-full shadow-sm transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const utterance = new SpeechSynthesisUtterance(currentWord.targetWord);
                      utterance.lang = 'de-DE';
                      window.speechSynthesis.speak(utterance);
                    }}
                    title="Wort vorlesen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-8 text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full inline-block">
                Wort einprägen... Loslassen zum Tippen!
              </p>
            </div>
          )}

          {gameState === 'WRITING' && (
            <form 
              onSubmit={handleSubmit} 
              className={`w-full transition-transform relative ${errorShake ? 'animate-shake' : ''}`}
            >
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className={`w-full text-center text-4xl font-bold py-6 px-4 bg-white dark:bg-slate-800 border-4 ${errorShake ? 'border-red-500 text-red-500' : 'border-indigo-500'} rounded-2xl shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30 dark:text-white transition-all relative z-10`}
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
                    <span className="text-4xl font-bold text-slate-800 dark:text-white opacity-30">
                      {currentWord.targetWord}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-center mt-4 text-slate-500 dark:text-slate-400 font-medium pointer-events-none">
                Drücke Enter zum Bestätigen
              </p>
              <div className="mt-8 text-center relative z-30">
                <button
                  type="button"
                  onClick={() => setGameState('IDLE')}
                  className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-4 px-4 py-2"
                >
                  Wort nochmal ansehen
                </button>
              </div>
            </form>
          )}

          {gameState === 'FINISHED' && (
            <div className="text-center transform transition-transform scale-110 pointer-events-none">
              <span className="text-7xl mb-6 block">🏆</span>
              <h2 className="text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight drop-shadow-sm">
                Geschafft!
              </h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">
                Du hast alle {words.length} Wörter erfolgreich absolviert.
              </p>
              
              <div className="mt-6 flex justify-center">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 inline-block">
                  <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">
                    Efficiency Index (EI)
                  </div>
                  <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
                    {efficiencyIndex.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-6 py-4 rounded-2xl">
                <span>Spicker gesamt: {metrics.peeks}</span>
                <span className="hidden sm:inline">•</span>
                <span>Fehler gesamt: {Math.max(0, metrics.attempts - words.length)}</span>
              </div>
              
              <div className="mt-10 pointer-events-auto">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
                >
                  Zurück zum Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Dev-Buttons Layer (nur sichtbar, wenn das Spiel läuft und BATTLE aktiv ist) */}
      {gameState !== 'FINISHED' && gameState !== 'IDLE' && words.length > 0 && gameMode === 'BATTLE' && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-50">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setForceFlicker(prev => !prev);
            }}
            className="text-xs bg-black/50 text-white px-3 py-1 rounded opacity-50 hover:opacity-100 transition-opacity"
          >
            {forceFlicker ? 'Stop Flimmern' : 'Simuliere Flimmern'}
          </button>
          {gameState === 'WRITING' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setInkSplats(prev => [...prev, generateInkSplat()]);
              }}
              className="text-xs bg-black/50 text-white px-3 py-1 rounded opacity-50 hover:opacity-100 transition-opacity"
            >
              Simuliere Tinte
            </button>
          )}
        </div>
      )}
    </div>
  );
};

