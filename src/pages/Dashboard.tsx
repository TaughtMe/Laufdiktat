import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';
import { parseCSV } from '../utils/csvParser';
import type { GameMode } from '../types/game';

type DashboardStep = 'IMPORT' | 'SETTINGS' | 'LOBBY' | 'LIVE';

interface StudentResult {
  name?: string;
  score: number;
  peeks: number;
  attempts: number;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<DashboardStep>('IMPORT');
  const [manualInput, setManualInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [studentsInLobby, setStudentsInLobby] = useState<string[]>([]);
  const [connectionWarning, setConnectionWarning] = useState(false);
  
  const words = useGameStore((state) => state.words);
  const setWords = useGameStore((state) => state.setWords);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const battleOptions = useGameStore((state) => state.battleOptions);
  const setBattleOptions = useGameStore((state) => state.setBattleOptions);

  useEffect(() => {
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  }, []);

  const handleOpenLobby = async () => {
    if (words.length === 0) {
      alert("Bitte füge zuerst Wörter hinzu!");
      return;
    }
    const channel = supabase.channel(roomCode);
    
    channel.on(
      'broadcast',
      { event: 'student-joined' },
      (payload) => {
        if (payload.payload?.name) {
          setStudentsInLobby((prev) => [...prev, payload.payload.name]);
        }
      }
    );

    channel.on(
      'broadcast',
      { event: 'student-finished' },
      (payload) => {
        setResults((prev) => [...prev, payload.payload as StudentResult]);
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionWarning(false);
        setCurrentStep('LOBBY');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionWarning(true);
      }
    });
  };

  const handleStartSession = () => {
    const channel = supabase.channel(roomCode);
    channel.send({
      type: 'broadcast',
      event: 'session-start',
      payload: {
        words,
        gameMode,
        battleOptions
      }
    });
    setSessionActive(true);
    setCurrentStep('LIVE');
  };

  const handleEndSession = async () => {
    await supabase.removeChannel(supabase.channel(roomCode));
    setSessionActive(false);
    setCurrentStep('IMPORT');
    setWords([]);
    setResults([]);
    setStudentsInLobby([]);
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setManualInput(value);
    const parsed = parseCSV(value);
    setWords(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setWords(parsed);
      setManualInput(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900">
      {connectionWarning && (
        <div className="bg-red-500 text-white text-center py-2 text-sm font-medium z-50">
          Verbindung zum Server verloren. Echtzeit-Updates sind derzeit nicht möglich.
        </div>
      )}
      <header className="py-6 px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="mr-4 p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center"
            title="Zurück zur Startseite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">Lehrer-Dashboard</h1>
        </div>
        
        {/* Step Indicator */}
        <div className="hidden sm:flex items-center space-x-2 text-sm font-medium">
          {['IMPORT', 'SETTINGS', 'LOBBY', 'LIVE'].map((step, idx) => (
            <React.Fragment key={step}>
              <span className={currentStep === step ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-600'}>
                {step}
              </span>
              {idx < 3 && <span className="text-slate-300 dark:text-slate-700">/</span>}
            </React.Fragment>
          ))}
        </div>
      </header>
      
      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-6 sm:gap-8">
          
          {/* Schritt 1: IMPORT */}
          {currentStep === 'IMPORT' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">1. Wortliste importieren</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  CSV-Datei hochladen (.csv, .txt)
                </label>
                <input 
                  type="file" 
                  accept=".csv, .txt" 
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-slate-500 dark:text-slate-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100
                    dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Oder manuell eingeben (Ein Wort pro Zeile)
                </label>
                <textarea
                  value={manualInput}
                  onChange={handleManualInputChange}
                  className="w-full h-48 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white resize-none"
                  placeholder="Elefant&#10;Giraffe&#10;Nashorn"
                />
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  Geladene Wörter: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{words.length}</span>
                </div>
                
                <button 
                  onClick={() => setCurrentStep('SETTINGS')}
                  disabled={words.length === 0}
                  className="px-6 py-3 bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-bold transition-all hover:bg-indigo-700 shadow-md"
                >
                  Weiter &rarr;
                </button>
              </div>
            </section>
          )}

          {/* Schritt 2: SETTINGS */}
          {currentStep === 'SETTINGS' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">2. Spielmodus & Optionen</h2>
              
              <div className="space-y-4 mb-8">
                {(['LAUFDIKTAT', 'UEBUNG', 'BATTLE'] as GameMode[]).map((mode) => (
                  <label key={mode} className="flex items-center space-x-3 cursor-pointer group p-3 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors">
                    <input
                      type="radio"
                      name="gameMode"
                      value={mode}
                      checked={gameMode === mode}
                      onChange={() => setGameMode(mode)}
                      className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {mode === 'LAUFDIKTAT' ? 'Klassisches Laufdiktat' : mode === 'UEBUNG' ? 'Freie Übung (ohne Stress)' : 'Battle-Modus (Multiplayer)'}
                    </span>
                  </label>
                ))}
              </div>

              <div className={`p-5 rounded-xl border transition-all duration-300 ${gameMode === 'BATTLE' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10' : 'border-slate-100 bg-slate-50 opacity-50 grayscale dark:border-slate-800 dark:bg-slate-900'}`}>
                <h3 className="font-semibold text-amber-800 dark:text-amber-500 mb-4">Battle-Optionen</h3>
                <div className="space-y-4">
                  <label className={`flex items-center space-x-3 ${gameMode === 'BATTLE' ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={battleOptions.ink}
                      disabled={gameMode !== 'BATTLE'}
                      onChange={(e) => setBattleOptions({ ink: e.target.checked })}
                      className="w-5 h-5 rounded text-amber-600 border-slate-300 focus:ring-amber-500 dark:border-slate-600 disabled:opacity-50"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Tintenfleck-Angriff (Sichtverschleierung)</span>
                  </label>
                  <label className={`flex items-center space-x-3 ${gameMode === 'BATTLE' ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={battleOptions.flicker}
                      disabled={gameMode !== 'BATTLE'}
                      onChange={(e) => setBattleOptions({ flicker: e.target.checked })}
                      className="w-5 h-5 rounded text-amber-600 border-slate-300 focus:ring-amber-500 dark:border-slate-600 disabled:opacity-50"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Flimmern-Angriff (Ablenkung)</span>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button 
                  onClick={() => setCurrentStep('IMPORT')}
                  className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
                >
                  &larr; Zurück
                </button>
                <button 
                  onClick={handleOpenLobby}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-2"
                >
                  Lobby öffnen <span className="text-xl">🚪</span>
                </button>
              </div>
            </section>
          )}

          {/* Schritt 3: LOBBY */}
          {currentStep === 'LOBBY' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center flex flex-col items-center">
              <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-slate-100">3. Lobby (Warten auf Schüler)</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8">Lass deine Schüler diesen QR-Code scannen oder den Code eingeben.</p>
              
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <QRCodeSVG 
                  value={`${window.location.origin}/?room=${roomCode}`} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <p className="text-5xl font-mono font-bold tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-10">
                {roomCode}
              </p>

              <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                  <span>Wartende Teilnehmer</span>
                  <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 py-1 px-3 rounded-full text-sm">
                    {studentsInLobby.length}
                  </span>
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {studentsInLobby.map((name, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 rounded-lg font-medium shadow-sm animate-in zoom-in duration-300">
                      {name}
                    </div>
                  ))}
                  {studentsInLobby.length === 0 && (
                    <div className="col-span-full text-slate-400 dark:text-slate-500 italic py-4">
                      Noch niemand hier...
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 w-full flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleEndSession}
                  className="px-6 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-bold transition-all w-full sm:w-auto"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleStartSession}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xl py-4 rounded-xl shadow-lg shadow-green-500/20 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Diktat jetzt starten</span>
                  <span className="text-2xl">🚀</span>
                </button>
              </div>
            </section>
          )}

          {/* Schritt 4: LIVE */}
          {currentStep === 'LIVE' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                    Live-Ergebnisse
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">Raum-Code: <span className="font-mono font-bold text-indigo-500">{roomCode}</span></p>
                </div>
                
                <button 
                  onClick={handleEndSession}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg font-medium transition-colors"
                >
                  Sitzung beenden
                </button>
              </div>

              <div className="space-y-4">
                {results.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-4xl block mb-4">🏃‍♂️</span>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Die Schüler bearbeiten das Diktat...</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {results.map((result, index) => (
                      <li key={index} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-left-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold">
                            #{index + 1}
                          </div>
                          <span className="font-bold text-lg text-slate-800 dark:text-slate-200">
                            {result.name || `Teilnehmer ${index + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <span className="block text-slate-400 text-xs uppercase font-bold tracking-wider">Peeks</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{result.peeks}</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-slate-400 text-xs uppercase font-bold tracking-wider">Fehler</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{Math.max(0, result.attempts - words.length)}</span>
                          </div>
                          <div className="text-right pl-4 border-l border-slate-200 dark:border-slate-700">
                            <span className="block text-slate-400 text-xs uppercase font-bold tracking-wider">Score (EI)</span>
                            <span className="font-black text-xl text-indigo-600 dark:text-indigo-400">{result.score.toFixed(2)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
};
