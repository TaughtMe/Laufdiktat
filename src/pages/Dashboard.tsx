import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Sparkles,
  ArrowRight,
  Check,
  ChevronLeft,
  Activity,
  XCircle,
  Download,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useDashboardRoom } from '../hooks/dashboard/useDashboardRoom';
import { useManualHighlighting } from '../hooks/dashboard/useManualHighlighting';
import { useMathImport } from '../hooks/dashboard/useMathImport';
import { parseCSV } from '../utils/dashboard/csvParser';
import { AnimalAvatar } from '../components/shared/AnimalAvatar';
import { NumberStepper } from '../components/shared/NumberStepper';
import { DashboardOnboarding, ONBOARDING_KEY } from '../components/dashboard/DashboardOnboarding';
import { DashboardMobileWarning } from '../components/dashboard/DashboardMobileWarning';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { WizardFooter } from '../components/dashboard/WizardFooter';
import { ImportStep } from '../components/dashboard/ImportStep';
import { type DashboardStep } from '../components/dashboard/stepMeta';
import { LegalLink } from '../components/shared/LegalLink';
import { VersionBadge } from '../components/shared/VersionBadge';
import { APP_VERSION } from '../pwa';
import { useUpdatePoller } from '../hooks/shared/useUpdatePoller';
import { useIsSmallScreen } from '../hooks/shared/useIsSmallScreen';
import type { GameMode } from '../types/game';
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

          {/* Schritt 2: SETTINGS */}
          {currentStep === 'SETTINGS' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-850 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[auto] md:min-h-[800px] md:h-[950px] flex flex-col justify-between">
              <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-850">
                <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">
                  2. Spielmodus &amp; Optionen
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Diktat für die Klasse einrichten.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 mb-6">
                
                {/* Left Column (Col span 7) */}
                <div className="md:col-span-7 flex flex-col gap-6 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-2">
                  {/* Mode Selector */}
                  <div className="flex flex-col gap-3">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      Modus wählen
                    </span>
                    
                    <div className="space-y-3">
                      {([
                        {
                          id: 'LAUFDIKTAT',
                          name: 'Klassisches Laufdiktat',
                          desc: '2-Finger-Touch zum Einprägen, danach Wort tippen.',
                          icon: '🏃‍♂️'
                        },
                        {
                          id: 'UEBUNG',
                          name: 'Freie Übung',
                          desc: 'Ohne Stress – mit Vorlesen und Buchstaben-Hilfen.',
                          icon: '📖'
                        },
                        {
                          id: 'BATTLE',
                          name: 'Battle-Modus',
                          desc: 'Gegeneinander – mit Störangriffen (Tinte, Flimmern).',
                          icon: '⚔️'
                        },
                        {
                          id: 'STATION',
                          name: 'Stations-Modus',
                          desc: 'Auf Papier schreiben, Tablet zeigt nur die Wörter.',
                          icon: '📋'
                        }
                      ] as Array<{ id: string; name: string; desc: string; icon: string }>).map((mode) => {
                        const isSelected = (stationMode ? 'STATION' : gameMode) === mode.id;
                        return (
                          <div
                            key={mode.id}
                            onClick={() => {
                              if (mode.id === 'STATION') {
                                setStationMode(true);
                              } else {
                                setStationMode(false);
                                setGameMode(mode.id as GameMode);
                              }
                            }}
                            className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 ${
                              isSelected
                                ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/10 shadow-sm'
                                : 'border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900'
                            }`}
                          >
                            {/* Checkbox / Radio Circle */}
                            <div className="mt-1 flex items-center justify-center">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'border-brand-500 bg-brand-500 text-white font-bold' 
                                  : 'border-slate-350 dark:border-slate-700'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <span className="font-bold text-darkteal-800 dark:text-white flex items-center gap-2">
                                <span className="text-lg">{mode.icon}</span>
                                {mode.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-450 block mt-1 leading-relaxed">
                                {mode.desc}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Right Column (Col span 5) */}
                <div className="md:col-span-5 flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-3 block">
                    Modus-Optionen
                  </span>
                  
                  {(() => {
                    const sel: string = stationMode ? 'STATION' : gameMode;
                    const panelClass = "bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl p-5 flex flex-col gap-3.5 h-full animate-in fade-in duration-300 shadow-sm";

                    // Einheitlicher Schalter (wie der Ton-Schalter), für alle Optionen.
                    const toggleRow = (
                      icon: string,
                      label: string,
                      desc: string | null,
                      checked: boolean,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
                    ) => (
                      <label className="flex items-center justify-between gap-3 cursor-pointer p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800">
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2.5 text-sm font-bold text-darkteal-800 dark:text-white">
                            <span className="text-lg">{icon}</span> {label}
                          </span>
                          {desc ? (
                            <span className="block text-[11px] text-slate-500 dark:text-slate-450 mt-0.5 leading-relaxed">{desc}</span>
                          ) : null}
                        </span>
                        <div className="relative shrink-0">
                          <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
                          <div className="w-12 h-7 bg-slate-250 dark:bg-slate-800 peer-checked:bg-brand-500 rounded-full transition-colors duration-250"></div>
                          <div className="absolute left-1 top-1 w-5 h-5 bg-white dark:bg-slate-100 rounded-full shadow-md transition-transform duration-250 peer-checked:translate-x-5"></div>
                        </div>
                      </label>
                    );

                    const header = (color: string, title: string) => (
                      <div className="flex items-center gap-2.5 text-darkteal-800 dark:text-white">
                        <Sparkles className={`w-5 h-5 ${color}`} />
                        <h3 className="font-bold text-sm uppercase tracking-wide">{title}</h3>
                      </div>
                    );

                    const tonRow = toggleRow('🔊', 'Vorlesen (Ton)', 'Wort vorlesen lassen – zählt als Spicker.', isTtsEnabled, toggleTts);
                    const starsRow = toggleRow('⭐', 'Sterne für Schüler', 'Bewertung (Sterne + Tempo) am Ende anzeigen.', showStars, (e) => setShowStars(e.target.checked));

                    if (sel === 'BATTLE') {
                      return (
                        <div className={panelClass}>
                          {header('text-amber-500', 'Battle-Optionen')}
                          {toggleRow('🖋️', 'Tintenfleck-Angriff', 'Zufällige Tintenflecke verdecken die Sicht.', battleOptions.ink, (e) => setBattleOptions({ ink: e.target.checked }))}
                          {toggleRow('✨', 'Flimmern-Angriff', 'Bildschirm flimmert beim Einprägen.', battleOptions.flicker, (e) => setBattleOptions({ flicker: e.target.checked }))}
                          {starsRow}
                        </div>
                      );
                    }

                    if (sel === 'UEBUNG') {
                      return (
                        <div className={panelClass}>
                          {header('text-brand-500', 'Übungs-Optionen')}
                          {tonRow}
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800">
                            <label className="block text-xs font-bold text-darkteal-800 dark:text-slate-300 mb-2 uppercase tracking-wider">
                              Fehlversuche bis zur Lösung
                            </label>
                            <div className="flex items-center gap-3">
                              <NumberStepper value={uebungMaxAttempts} onChange={setUebungMaxAttempts} min={1} max={10} />
                              <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                So viele Fehlversuche, dann erscheint das ganze Wort. Davor schrittweise Buchstaben-Hinweise.
                              </span>
                            </div>
                          </div>
                          {starsRow}
                        </div>
                      );
                    }

                    if (sel === 'STATION') {
                      return (
                        <div className={panelClass}>
                          {header('text-emerald-500', 'Stations-Optionen')}
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800">
                            <label className="block text-xs font-bold text-darkteal-800 dark:text-slate-300 mb-2 uppercase tracking-wider">
                              Anzahl der Schüler / Stationen
                            </label>
                            <div className="flex items-center gap-3">
                              <NumberStepper value={stationCount} onChange={setStationCount} min={1} max={100} />
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                (Erstellt Nummernfelder für die Schüler)
                              </span>
                            </div>
                          </div>
                          {tonRow}
                        </div>
                      );
                    }

                    // LAUFDIKTAT
                    return (
                      <div className={panelClass}>
                        {header('text-brand-500', 'Optionen')}
                        {starsRow}
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Step 2 Bottom Actions */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                <button 
                  onClick={() => setCurrentStep('IMPORT')}
                  className="flex items-center gap-1 text-darkteal-800 hover:text-brand-500 dark:text-slate-400 dark:hover:text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Zurück</span>
                </button>
                
                {/* Stepper Dots (Schritt 2 von 3) */}
                <div className="bg-[#e6effa] dark:bg-slate-900 rounded-full py-1.5 px-4 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1] dark:bg-slate-750" />
                  <span className="w-2.5 h-2.5 rounded-full bg-darkteal-800 dark:bg-white" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1] dark:bg-slate-750" />
                  <span className="ml-1 text-[11px]">Schritt 2 von 3</span>
                </div>
                
                <button 
                  onClick={handleOpenLobby}
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Lobby öffnen</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* Schritt 3: LOBBY */}
          {currentStep === 'LOBBY' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-850 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center flex flex-col justify-between items-center min-h-[auto] md:min-h-[800px] md:h-[950px]">
              
              {/* Top part: Header, QR Code & Room Code */}
              <div className="flex flex-col items-center w-full">
                <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">
                  3. Lobby (Warten auf Schüler)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-455 mt-1 mb-6 max-w-md">
                  Lass deine Schüler diesen QR-Code scannen oder den Code eingeben, um beizutreten.
                </p>
                
                {stationMode && (
                  <span className="inline-flex items-center gap-1.5 bg-[#e5fff5] dark:bg-emerald-950/30 text-[#004730] dark:text-[#5efcc2] text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-emerald-200/30">
                    <span>📋</span> Stations-Modus aktiv
                  </span>
                )}
                
                <div className="bg-white dark:bg-white p-4 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-100 mb-6">
                  <QRCodeSVG 
                    value={`${window.location.origin}/?room=${roomCode}`} 
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                {/* Premium Room Code Card */}
                <div className="bg-[#f0f5fa] dark:bg-slate-900 border border-slate-150/40 dark:border-slate-850 px-8 py-2 rounded-2xl mb-6 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Raum-Code
                  </span>
                  <p className="text-4xl font-mono font-black tracking-[0.2em] text-brand-500 pl-[0.2em]">
                    {roomCode}
                  </p>
                </div>
              </div>

              {/* Middle part: Waiting Participants / Connection Status (flex-grow + scrollable) */}
              <div className="w-full bg-[#f4f6fa] dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-100 dark:border-slate-850/80 flex-1 min-h-0 overflow-y-auto mb-6 flex flex-col justify-center">
                {connectionWarning ? (
                  /* Verbindung abgebrochen zum Server */
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-800 max-w-md w-full mx-auto flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-450 flex items-center justify-center mb-4">
                      <XCircle className="w-6 h-6 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Server-Verbindung verloren
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[280px] leading-relaxed">
                      Die Echtzeit-Verbindung zum Server wurde unterbrochen. Bitte versuche es erneut.
                    </p>
                    
                    <button
                      type="button"
                      onClick={handleOpenLobby}
                      className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Verbindung wiederherstellen
                    </button>
                  </div>
                ) : (hadTwoConnections && studentsInLobby.length < 1) ? (
                  /* Verbindung abgebrochen Zustand */
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-800 max-w-md w-full mx-auto flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
                      <XCircle className="w-6 h-6 animate-bounce" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Verbindung abgebrochen
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[280px] leading-relaxed">
                      Ein zuvor verbundenes Gerät hat die Verbindung verloren.
                    </p>
                    
                    <button
                      type="button"
                      onClick={handleOpenLobby}
                      className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Verbindung wiederherstellen
                    </button>
                  </div>
                ) : studentsInLobby.length < 1 ? (
                  /* Welle 1: "Warte auf Verbindung"-Panel */
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-800 max-w-md w-full mx-auto flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 animate-pulse">
                      <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Warte auf Verbindung...
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[280px] leading-relaxed">
                      Sobald mindestens ein Gerät verbunden ist, kannst du das Diktat starten.
                    </p>
                    
                    <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-1.5 rounded-full">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      <span>Verbunden: {studentsInLobby.length}</span>
                    </div>

                    {/* Single device connected feedback */}
                    {studentsInLobby.length === 1 && (
                      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 w-full animate-in slide-in-from-bottom-2 duration-300">
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                          Bereits verbunden:
                        </p>
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150/50 dark:border-slate-800 p-3 rounded-xl flex items-center gap-3">
                          <AnimalAvatar studentName={studentsInLobby[0]} className="w-9 h-9" />
                          <span className="text-xs font-bold text-darkteal-800 dark:text-white truncate flex-1 text-left">
                            {studentsInLobby[0]}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Welle 2: Peer-Karten mit AnimalAvataren */
                  <div className="w-full flex flex-col h-full justify-start">
                    <h3 className="font-bold text-base text-darkteal-800 dark:text-white mb-6 flex items-center justify-center gap-2">
                      <span>Verbundene Geräte</span>
                      <span className="bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 py-0.5 px-3 rounded-full text-xs font-extrabold">
                        {studentsInLobby.length}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto w-full animate-in zoom-in-95 duration-300">
                      {studentsInLobby.map((name, i) => {
                        const studentVersion = studentVersions[name];
                        const versionOk = !studentVersion || studentVersion === APP_VERSION;
                        return (
                          <div
                            key={i}
                            className="rounded-2xl border p-4 flex flex-col items-center text-center transition-all border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-sm"
                          >
                            <AnimalAvatar studentName={name} className="w-14 h-14 mb-2" />
                            <span className="text-sm font-bold text-darkteal-800 dark:text-white truncate w-full">
                              {name}
                            </span>
                            {studentVersion && (
                              <span
                                className={`text-[10px] font-bold mt-0.5 ${
                                  versionOk
                                    ? 'text-slate-350 dark:text-slate-550'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                                title={versionOk ? undefined : `Erwartet: v${APP_VERSION}`}
                              >
                                v{studentVersion} {versionOk ? '✓' : '⚠ Update nötig'}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-100/30 dark:border-emerald-800/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-450 font-bold uppercase tracking-wider">
                                Online
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom part: Footer Buttons */}
              <div className="w-full flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleEndSession}
                  className="px-6 py-3.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-bold text-sm transition-all w-full sm:w-auto cursor-pointer"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleStartSession}
                  disabled={!stationMode && studentsInLobby.length < 1}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-850 disabled:text-slate-450 disabled:shadow-none text-white text-base py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>{stationMode ? 'Stationen starten' : 'Diktat jetzt starten'}</span>
                  <span className="text-xl">🚀</span>
                </button>
              </div>
            </section>
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
