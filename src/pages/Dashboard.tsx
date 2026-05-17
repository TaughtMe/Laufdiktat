import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';
import { parseCSV } from '../utils/csvParser';
import type { GameMode } from '../types/game';

interface StudentResult {
  score: number;
  peeks: number;
  attempts: number;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [manualInput, setManualInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [connectionWarning, setConnectionWarning] = useState(false);
  
  const words = useGameStore((state) => state.words);
  const setWords = useGameStore((state) => state.setWords);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const battleOptions = useGameStore((state) => state.battleOptions);
  const setBattleOptions = useGameStore((state) => state.setBattleOptions);

  useEffect(() => {
    // Generate random 4-digit code
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  }, []);

  const handleStartSession = async () => {
    if (words.length === 0) {
      alert("Bitte füge zuerst Wörter hinzu!");
      return;
    }
    const channel = supabase.channel(roomCode);
    
    // Listen for student results
    channel.on(
      'broadcast',
      { event: 'student-finished' },
      (payload) => {
        setResults((prev) => [...prev, payload.payload as StudentResult]);
      }
    );

    // Subscribe first, then send
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionWarning(false);
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
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionWarning(true);
      }
    });
  };

  const handleEndSession = async () => {
    await supabase.removeChannel(supabase.channel(roomCode));
    setSessionActive(false);
    setWords([]);
    setResults([]);
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
      setManualInput(text); // Synchronisiere Textarea mit Dateiinhalt
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
      <header className="py-6 px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center">
        <button 
          onClick={() => navigate('/')}
          className="mr-4 p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center"
          title="Zurück zur Startseite"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Lehrer-Dashboard</h1>
      </header>
      
      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto flex flex-col md:grid md:grid-cols-2 gap-6 sm:gap-8">
          
          {/* Linker Bereich: Daten-Input */}
          <section className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Wortliste importieren</h2>
            
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
            
            <div className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 inline-block px-3 py-1 rounded-full">
              Geladene Wörter: <span className="text-indigo-600 dark:text-indigo-400">{words.length}</span>
            </div>
          </section>

          {/* Rechter Bereich: Konfiguration */}
          <section className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
            <h2 className="text-xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Spielmodus & Optionen</h2>
            
            <div className="space-y-4 mb-8">
              {(['LAUFDIKTAT', 'UEBUNG', 'BATTLE'] as GameMode[]).map((mode) => (
                <label key={mode} className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="gameMode"
                    value={mode}
                    checked={gameMode === mode}
                    onChange={() => setGameMode(mode)}
                    className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {mode === 'LAUFDIKTAT' ? 'Klassisches Laufdiktat' : mode === 'UEBUNG' ? 'Freie Übung' : 'Battle-Modus (Multiplayer)'}
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
                  <span className="text-slate-700 dark:text-slate-300">Tintenfleck-Angriff (Verschleierung)</span>
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

            {/* Supabase Realtime & QR Code */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Schüler Einladen</h3>
              
              <div className="mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100 inline-block">
                <QRCodeSVG 
                  value={`${window.location.origin}/?room=${roomCode}`} 
                  size={150}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <p className="text-3xl font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400 mb-6">
                {roomCode}
              </p>

              <button
                onClick={handleStartSession}
                disabled={sessionActive || words.length === 0}
                className={`w-full py-3 px-6 rounded-xl font-bold text-white shadow-md transition-all active:scale-95 flex justify-center items-center ${
                  sessionActive 
                    ? 'hidden' 
                    : words.length === 0 
                      ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                Sitzung freigeben
              </button>
              
              {sessionActive && (
                <button
                  onClick={handleEndSession}
                  className="w-full py-3 px-6 rounded-xl font-bold text-white shadow-md transition-all active:scale-95 flex justify-center items-center bg-red-500 hover:bg-red-600"
                >
                  Sitzung beenden
                </button>
              )}

              {words.length === 0 && !sessionActive && (
                <p className="text-xs text-red-500 mt-2">Bitte zuerst Wörter hinzufügen</p>
              )}
            </div>

            {/* Live-Monitoring UI */}
            {sessionActive && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center justify-between">
                  <span>Live-Ergebnisse</span>
                  <span className="text-xs font-normal px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">
                    {results.length} beendet
                  </span>
                </h3>
                
                {results.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4">
                    Noch keine Ergebnisse...
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {results.map((result, index) => (
                      <li key={index} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg text-sm flex justify-between items-center">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Teilnehmer {index + 1}</span>
                        <div className="text-right">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-3">EI = {result.score.toFixed(2)}</span>
                          <span className="text-slate-500 dark:text-slate-500 text-xs">(Peeks: {result.peeks}, Errors: {Math.max(0, result.attempts - words.length)})</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          </section>

        </div>
      </main>
    </div>
  );
};
