import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, XCircle, Download } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useDashboardRoom } from '../hooks/dashboard/useDashboardRoom';
import { useManualHighlighting } from '../hooks/dashboard/useManualHighlighting';
import { useMathImport } from '../hooks/dashboard/useMathImport';
import { parseCSV } from '../utils/dashboard/csvParser';
import { AnimalAvatar } from '../components/shared/AnimalAvatar';
import { DashboardOnboarding, ONBOARDING_KEY } from '../components/dashboard/DashboardOnboarding';
import { DashboardMobileWarning } from '../components/dashboard/DashboardMobileWarning';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { WizardFooter } from '../components/dashboard/WizardFooter';
import { ImportStep } from '../components/dashboard/ImportStep';
import { SettingsStep } from '../components/dashboard/SettingsStep';
import { LobbyStep } from '../components/dashboard/LobbyStep';
import { type DashboardStep } from '../components/dashboard/stepMeta';
import { LegalLink } from '../components/shared/LegalLink';
import { VersionBadge } from '../components/shared/VersionBadge';
import { APP_VERSION } from '../pwa';
import { useUpdatePoller } from '../hooks/shared/useUpdatePoller';
import { useIsSmallScreen } from '../hooks/shared/useIsSmallScreen';
import { exportResultsToCSV } from '../utils/dashboard/exportUtils';
import { computeStars } from '../utils/game/scoring';

export const Dashboard = () => {
  const navigate = useNavigate();

  // Regelmäßig auf ein neues Update prüfen, aber nie automatisch anwenden –
  // ein Reload während Lobby/Live-Session würde den Raum kappen. Der Lehrkraft
  // bleibt die Entscheidung (VersionBadge leuchtet, Klick wendet an).
  useUpdatePoller({ enabled: true, intervalMs: 5 * 60 * 1000, autoApply: false });

  // Das Dashboard ist auf Tablet/Laptop ausgelegt; auf schmalen Bildschirmen
  // zeigen wir statt eines kaputt gequetschten Layouts einen Hinweis (siehe
  // Render-Ende unten). "Trotzdem öffnen" merkt sich die Entscheidung nur für
  // diese Sitzung (kein persistenter Zustand nötig).
  const isSmallScreen = useIsSmallScreen();
  const [forceMobileDashboard, setForceMobileDashboard] = useState(false);

  const [currentStep, setCurrentStep] = useState<DashboardStep>('IMPORT');
  const stepRef = useRef<DashboardStep>('IMPORT');
  // Funktionsübersicht nur beim ersten Öffnen des Dashboards zeigen.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) !== '1'; } catch { return false; }
  });
  const dismissOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* ignore */ }
    setShowOnboarding(false);
  };

  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);

  const [manualInput, setManualInput] = useState('');
  const [importMode, setImportMode] = useState<'lines' | 'sentences' | 'manual' | 'math'>('lines');

  const [roomCode, setRoomCode] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const words = useGameStore((state) => state.words);
  const setWords = useGameStore((state) => state.setWords);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const battleOptions = useGameStore((state) => state.battleOptions);
  const setBattleOptions = useGameStore((state) => state.setBattleOptions);
  const stationMode = useGameStore((state) => state.stationMode);
  const setStationMode = useGameStore((state) => state.setStationMode);
  const stationCount = useGameStore((state) => state.stationCount);
  const setStationCount = useGameStore((state) => state.setStationCount);
  const isTtsEnabled = useGameStore((state) => state.isTtsEnabled);
  const toggleTts = useGameStore((state) => state.toggleTts);
  const uebungMaxAttempts = useGameStore((state) => state.uebungMaxAttempts);
  const setUebungMaxAttempts = useGameStore((state) => state.setUebungMaxAttempts);
  const showStars = useGameStore((state) => state.showStars);
  const setShowStars = useGameStore((state) => state.setShowStars);

  const {
    results,
    studentsInLobby,
    studentVersions,
    hadTwoConnections,
    connectionWarning,
    liveProgress,
    stationStates,
    handleOpenLobby,
    handleStartSession,
    handleEndSession,
  } = useDashboardRoom({
    roomCode,
    setRoomCode,
    stepRef,
    setCurrentStep,
    wordsLength: words.length,
    clearWords: () => setWords([]),
  });

  // Ganze Hook-Rückgaben werden an die Step-Komponenten durchgereicht
  // (reine Präsentation); hier nur destrukturieren, was Handler brauchen.
  const highlighting = useManualHighlighting({ manualInput, importMode, setWords });
  const { resetChunks, applyChunksToWords, handleResetChunks } = highlighting;

  const math = useMathImport({ importMode, setWords });

  const handleExportCSV = () => {
    if (stationMode) {
      const data = Array.from({ length: stationCount }, (_, i) => {
        const num = i + 1;
        const state = stationStates.get(num);
        const status = getStationStatus(num);
        const progress = status === 'done' ? 100 : (state ? Math.round(((state.currentIndex + 1) / words.length) * 100) : 0);
        const reached = status === 'done' ? 'Fertig' : (state ? `${state.currentIndex + 1}/${words.length}` : 'Inaktiv');
        return {
          name: `Schüler Nr. ${num}`,
          reachedStation: reached,
          progressPercent: progress
        };
      });
      exportResultsToCSV(data);
    } else {
      const data = studentsInLobby.map((name) => {
        const result = results.find((r) => r.name === name);
        const isFinished = !!result;
        return {
          name: name,
          reachedStation: isFinished ? 'Fertig' : 'Aktiv',
          progressPercent: isFinished ? 100 : 0,
          errors: result?.errors ?? 0,
          attempts: result?.attempts ?? 0,
          peeks: result?.peeks ?? 0,
          stars: isFinished ? computeStars(result?.errors ?? 0, result?.wordCount ?? words.length) : undefined,
        };
      });
      exportResultsToCSV(data, wordErrorRanking);
    }
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setManualInput(value);
    resetChunks(); // Reset manual highlighting when raw text changes
    const parsed = parseCSV(value, importMode === 'sentences' ? 'sentences' : 'lines');
    setWords(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setManualInput(text);
      resetChunks(); // Reset manual highlighting when raw text changes
      const parsed = parseCSV(text, importMode === 'sentences' ? 'sentences' : 'lines');
      setWords(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportModeChange = (mode: 'lines' | 'sentences' | 'manual' | 'math') => {
    setImportMode(mode);
    if (mode === 'math') {
      // Mathe-Aufgaben werden aus mathInput/mathGap/mathGaps per Effekt gebaut.
      return;
    } else if (mode === 'manual') {
      applyChunksToWords();
    } else {
      const parsed = parseCSV(manualInput, mode);
      setWords(parsed);
    }
  };

  const getStationStatus = (num: number): 'idle' | 'active' | 'done' => {
    const s = stationStates.get(num);
    if (!s) return 'idle';
    if (s.currentIndex >= words.length - 1 && s.peeks > 0) return 'done';
    return 'active';
  };

  // Fortschritt eines Schülers in Prozent (fertige = 100 %).
  const getStudentProgress = (name: string): number => {
    if (results.find((r) => r.name === name)) return 100;
    if (words.length === 0) return 0;
    const idx = liveProgress[name] ?? 0;
    return Math.min(100, Math.round((idx / words.length) * 100));
  };

  // Durchschnittlicher Fortschritt aller verbundenen Schüler.
  const overallProgress = studentsInLobby.length === 0
    ? 0
    : Math.round(
        studentsInLobby.reduce((acc, name) => acc + getStudentProgress(name), 0) /
          studentsInLobby.length
      );

  // Ranking: welche Wörter/Aufgaben wurden über alle Schüler am häufigsten falsch?
  const wordErrorRanking: Array<[string, number]> = (() => {
    const agg: Record<string, number> = {};
    for (const r of results) {
      if (!r.wordErrors) continue;
      for (const [w, n] of Object.entries(r.wordErrors)) agg[w] = (agg[w] || 0) + n;
    }
    return Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10);
  })();

  // Schritt-Navigation über den Pill-Stepper – identische Guards wie zuvor:
  // Schritte 2–4 nur mit Wortliste, Lobby-Klick öffnet den Realtime-Channel.
  const handleStepSelect = (step: DashboardStep) => {
    if (step !== 'IMPORT' && words.length === 0) return;
    if (step === 'LOBBY') {
      handleOpenLobby();
    } else {
      setCurrentStep(step);
    }
  };

  // Wizard-Footer: kontextabhängiger Primär-Button + Zurück je Schritt.
  const footerByStep: Record<DashboardStep, React.ComponentProps<typeof WizardFooter>> = {
    IMPORT: {
      canBack: false,
      onBack: () => {},
      nextLabel: 'Weiter zur Konfiguration',
      nextDisabled: words.length === 0,
      onNext: () => setCurrentStep('SETTINGS'),
    },
    SETTINGS: {
      canBack: true,
      onBack: () => setCurrentStep('IMPORT'),
      nextLabel: 'Lobby öffnen',
      onNext: handleOpenLobby,
    },
    LOBBY: {
      canBack: true,
      onBack: () => setCurrentStep('SETTINGS'),
      nextLabel: stationMode ? 'Stationen starten' : 'Diktat jetzt starten',
      nextVariant: 'ok',
      nextDisabled: !stationMode && studentsInLobby.length < 1,
      onNext: handleStartSession,
    },
    LIVE: {
      canBack: true,
      onBack: () => setCurrentStep('LOBBY'),
      nextLabel: 'Sitzung beenden',
      nextVariant: 'danger',
      onNext: handleEndSession,
    },
  };

  if (isSmallScreen && !forceMobileDashboard) {
    return <DashboardMobileWarning onContinueAnyway={() => setForceMobileDashboard(true)} />;
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-page text-ink overflow-x-hidden">
      {showOnboarding && <DashboardOnboarding onClose={dismissOnboarding} />}
      {connectionWarning && (
        <div className="bg-danger text-white text-center py-2 text-sm font-medium z-50 shrink-0">
          Verbindung zum Server verloren. Echtzeit-Updates sind derzeit nicht möglich.
        </div>
      )}
      <DashboardHeader
        currentStep={currentStep}
        stepsUnlocked={words.length > 0}
        onStepSelect={handleStepSelect}
        onBackToHome={() => navigate('/')}
      />
      <main className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-9 pt-2 pb-6">
        <div className="max-w-6xl mx-auto w-full min-h-full flex flex-col">
          {currentStep === 'IMPORT' && (
            <ImportStep
              importMode={importMode}
              onImportModeChange={handleImportModeChange}
              manualInput={manualInput}
              onManualInputChange={handleManualInputChange}
              onFileUpload={handleFileUpload}
              words={words}
              onResetChunks={handleResetChunks}
              highlighting={highlighting}
              math={math}
            />
          )}

          {currentStep === 'SETTINGS' && (
            <SettingsStep
              gameMode={gameMode}
              stationMode={stationMode}
              onSelectMode={(id) => {
                if (id === 'STATION') {
                  setStationMode(true);
                } else {
                  setStationMode(false);
                  setGameMode(id);
                }
              }}
              isTtsEnabled={isTtsEnabled}
              onToggleTts={toggleTts}
              uebungMaxAttempts={uebungMaxAttempts}
              onChangeAttempts={setUebungMaxAttempts}
              battleOptions={battleOptions}
              onSetBattleOptions={setBattleOptions}
              stationCount={stationCount}
              onChangeStationCount={setStationCount}
              showStars={showStars}
              onToggleStars={setShowStars}
            />
          )}

          {currentStep === 'LOBBY' && (
            <LobbyStep
              roomCode={roomCode}
              stationMode={stationMode}
              studentsInLobby={studentsInLobby}
              studentVersions={studentVersions}
              appVersion={APP_VERSION}
              connectionWarning={connectionWarning}
              hadTwoConnections={hadTwoConnections}
              onRetry={handleOpenLobby}
            />
          )}

          {/* Schritt 4: LIVE */}
          {currentStep === 'LIVE' && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
              {/* Live Header */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">Lehrer-Dashboard</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      LIVE SESSION
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Raum-Code: <span className="font-mono font-bold text-darkteal-800 dark:text-white">{roomCode}</span>
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleEndSession}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  <XCircle className="w-4 h-4" />
                  Sitzung beenden
                </button>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Status Card */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-8 sm:p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
                  {/* Runner Scene Info-Box */}
                  <div className="w-full max-w-md mx-auto mb-8 bg-slate-50/80 dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-100 dark:border-slate-850 flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.015)]">
                    {/* Left Icon (Desk / Laptop) */}
                    <div className="text-2xl w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-750 select-none shrink-0">
                      💻
                    </div>

                    {/* Running Track */}
                    <div className="flex-1 mx-4 h-12 relative border-b-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-start overflow-hidden">
                      <div className="animate-run-ping-pong absolute left-0 bottom-1 text-3xl select-none leading-none">
                        🏃‍♂️
                      </div>
                    </div>

                    {/* Right Icon (Clipboard) */}
                    <div className="text-2xl w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-750 select-none shrink-0">
                      📋
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-darkteal-800 dark:text-white">
                    Das Diktat läuft...
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed">
                    Die Schüler pendeln zwischen Station und Platz.
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="w-full max-w-md mt-8">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2 text-right">
                      {overallProgress}% Gesamtfortschritt
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Live-Statistik */}
                  <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-5">
                    <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-4">Live-Statistik</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Aktiv</span>
                        <span className="text-3xl font-black text-darkteal-800 dark:text-white">
                          {stationMode
                            ? Array.from({ length: stationCount }, (_, i) => i + 1).filter(n => getStationStatus(n) === 'active').length
                            : Math.max(0, studentsInLobby.length - results.length)
                          }
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Abgeschlossen</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                          {stationMode
                            ? Array.from({ length: stationCount }, (_, i) => i + 1).filter(n => getStationStatus(n) === 'done').length
                            : results.length
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Letzte Ereignisse */}
                  <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-5 flex-1 min-h-[180px]">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Letzte Ereignisse</h4>
                      <Activity className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="space-y-3.5">
                      {results.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-600 italic py-6 text-center">Noch keine Ereignisse...</p>
                      ) : (
                        results.slice(-3).reverse().map((r, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-darkteal-800 dark:text-white leading-tight">{r.name || 'Teilnehmer'} hat abgeschlossen</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {r.errors ?? 0} Fehler · {r.attempts} Versuche · {r.peeks} Spicker
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schüler Übersicht */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-darkteal-800 dark:text-white">Schüler Übersicht</h3>
                  <button
                    onClick={handleExportCSV}
                    disabled={stationMode ? stationCount === 0 : studentsInLobby.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-450 rounded-xl text-xs font-bold cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ergebnisse exportieren (CSV)</span>
                  </button>
                </div>
                
                {stationMode ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {Array.from({ length: stationCount }, (_, i) => i + 1).map((num) => {
                      const status = getStationStatus(num);
                      const state = stationStates.get(num);
                      const progress = state ? Math.round(((state.currentIndex + 1) / words.length) * 100) : 0;
                      return (
                        <div
                          key={num}
                          className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all duration-300 ${
                            status === 'done'
                              ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/10'
                              : status === 'active'
                              ? 'border-brand-200 dark:border-brand-800/50 bg-brand-50/30 dark:bg-brand-950/10 station-pulse'
                              : 'border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className={`text-2xl font-black mb-1 ${
                            status === 'done' ? 'text-emerald-600 dark:text-emerald-400'
                              : status === 'active' ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-300 dark:text-slate-700'
                          }`}>
                            {num}
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {status === 'done' ? 'Fertig' : status === 'active' ? `Wort ${(state?.currentIndex ?? 0) + 1}/${words.length}` : 'Inaktiv'}
                          </span>
                          <div className="w-full mt-2 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                status === 'done' ? 'bg-emerald-500' : status === 'active' ? 'bg-brand-500' : 'bg-transparent'
                              }`}
                              style={{ width: status === 'done' ? '100%' : `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {studentsInLobby.map((name, i) => {
                      const result = results.find(r => r.name === name);
                      const isFinished = !!result;
                      const progress = getStudentProgress(name);
                      const wordNo = Math.min((liveProgress[name] ?? 0) + 1, words.length);
                      return (
                        <div
                          key={i}
                          className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${
                            isFinished
                              ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10'
                              : 'border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <AnimalAvatar studentName={name} className="w-14 h-14 mb-2" />
                          <span className="text-sm font-bold text-darkteal-800 dark:text-white truncate w-full">{name}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                            {isFinished ? 'Fertig' : words.length > 0 ? `Wort ${wordNo}/${words.length}` : 'Aktiv'}
                          </span>
                          {isFinished && result && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {showStars && (
                                <span className="text-amber-500 mr-1">
                                  {'★'.repeat(computeStars(result.errors ?? 0, result.wordCount ?? words.length))}
                                </span>
                              )}
                              {result.errors ?? 0} F · {result.peeks} Sp
                            </span>
                          )}
                          <div className="w-full mt-2 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isFinished ? 'bg-emerald-500' : 'bg-brand-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {studentsInLobby.length === 0 && (
                      <div className="col-span-full text-center py-8">
                        <p className="text-sm text-slate-400 dark:text-slate-500 italic">Noch keine Schüler beigetreten...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Häufigste Fehler – Ranking über alle Schüler */}
              {!stationMode && (
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-6">
                  <h3 className="text-lg font-bold text-darkteal-800 dark:text-white mb-1">Häufigste Fehler</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Wo am meisten falsch gemacht wurde – hier lohnt sich das Weiterüben.
                  </p>
                  {wordErrorRanking.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic py-4 text-center">
                      Noch keine Fehler erfasst (Ergebnisse erscheinen, sobald Schüler abschließen).
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {wordErrorRanking.map(([word, count], idx) => {
                        const maxCount = wordErrorRanking[0][1] || 1;
                        return (
                          <li key={word} className="flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx + 1}.</span>
                            <span className="text-sm font-bold text-darkteal-800 dark:text-white w-32 sm:w-40 truncate shrink-0">{word}</span>
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                              <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold text-red-500 w-16 text-right shrink-0">
                              {count} {count === 1 ? 'Fehler' : 'Fehler'}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="mt-auto pt-4 text-center">
            <LegalLink />
          </div>
        </div>
      </main>
      <WizardFooter {...footerByStep[currentStep]} />
      <VersionBadge />
    </div>
  );
};
