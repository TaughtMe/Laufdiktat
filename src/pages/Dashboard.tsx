import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useDashboardRoom } from '../hooks/dashboard/useDashboardRoom';
import { useManualHighlighting } from '../hooks/dashboard/useManualHighlighting';
import { useMathImport } from '../hooks/dashboard/useMathImport';
import { parseCSV } from '../utils/dashboard/csvParser';
import { DashboardOnboarding, ONBOARDING_KEY } from '../components/dashboard/DashboardOnboarding';
import { DashboardMobileWarning } from '../components/dashboard/DashboardMobileWarning';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { WizardFooter } from '../components/dashboard/WizardFooter';
import { ImportStep } from '../components/dashboard/ImportStep';
import { SettingsStep } from '../components/dashboard/SettingsStep';
import { LobbyStep } from '../components/dashboard/LobbyStep';
import { LiveStep } from '../components/dashboard/LiveStep';
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

          {currentStep === 'LIVE' && (
            <LiveStep
              roomCode={roomCode}
              wordsCount={words.length}
              showStars={showStars}
              stationMode={stationMode}
              stationCount={stationCount}
              stationStates={stationStates}
              getStationStatus={getStationStatus}
              studentsInLobby={studentsInLobby}
              results={results}
              liveProgress={liveProgress}
              getStudentProgress={getStudentProgress}
              overallProgress={overallProgress}
              wordErrorRanking={wordErrorRanking}
              onExportCSV={handleExportCSV}
              exportDisabled={stationMode ? stationCount === 0 : studentsInLobby.length === 0}
            />
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
