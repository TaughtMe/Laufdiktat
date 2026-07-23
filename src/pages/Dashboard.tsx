import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useDashboardRoom } from '../hooks/dashboard/useDashboardRoom';
import { useMathImport } from '../hooks/dashboard/useMathImport';
import {
  buildTextSections,
  applyResultEdits,
  sectionsToWords,
  DEFAULT_SPLIT_CONFIG,
  type TextSplitConfig,
  type ManualRange,
  type TextSection,
} from '../utils/dashboard/textSections';
import { moveArrayItem } from '../utils/dashboard/reorder';
import { normalizeMathLine } from '../utils/dashboard/mathTasks';
import { DashboardOnboarding, ONBOARDING_KEY } from '../components/dashboard/DashboardOnboarding';
import { DashboardMobileWarning } from '../components/dashboard/DashboardMobileWarning';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { WizardFooter } from '../components/dashboard/WizardFooter';
import { ImportStep } from '../components/dashboard/ImportStep';
import { SectionManager } from '../components/dashboard/SectionManager';
import { SettingsStep } from '../components/dashboard/SettingsStep';
import { LobbyStep } from '../components/dashboard/LobbyStep';
import { LiveStep } from '../components/dashboard/LiveStep';
import { type DashboardStep } from '../components/dashboard/stepMeta';
import { LegalLink } from '../components/shared/LegalLink';
import { APP_VERSION } from '../pwa';
import { useUpdatePoller } from '../hooks/shared/useUpdatePoller';
import { useWakeLock } from '../hooks/shared/useWakeLock';
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

  // Auch das Lehrergerät wachhalten, solange ein Raum offen ist (Lobby/Live) --
  // z. B. iPad am Beamer: schläft der Bildschirm ein, reißt die Realtime-
  // Verbindung ab und die Lobby-/Live-Anzeige friert ein. Gegenstück zum
  // Wake Lock auf der Schülerseite (Game.tsx).
  useWakeLock(currentStep === 'LOBBY' || currentStep === 'LIVE');
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

  const [rawText, setRawText] = useState('');
  const [importMode, setImportMode] = useState<'text' | 'math'>('text');
  const [splitConfig, setSplitConfig] = useState<TextSplitConfig>(DEFAULT_SPLIT_CONFIG);
  // Manuelle Bereiche (P3): überschreiben einzelne automatische Grenzen. Werden
  // bei Textänderung zurückgesetzt, bei reiner Regeländerung aber beibehalten
  // (Feinkonzept, Reset-Matrix).
  const [manualRanges, setManualRanges] = useState<ManualRange[]>([]);
  // Kurzer Hinweis, dass eine Textänderung die manuellen Bereiche verworfen hat.
  const [manualResetNotice, setManualResetNotice] = useState(false);
  // Ergebnis-Ebene (P4): ausgeschlossene Abschnitte und benutzerdefinierte
  // Reihenfolge (je über Abschnitts-IDs). Verändern nie den Rohtext und werden
  // bei jeder Text-/Regel-/Bereichsänderung zurückgesetzt (Feinkonzept E).
  const [excludedSectionIds, setExcludedSectionIds] = useState<string[]>([]);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  // Frühere Stände der manuellen Bereiche für „letzte Änderung rückgängig".
  const [manualHistory, setManualHistory] = useState<ManualRange[][]>([]);
  // Die Abschnittsverwaltung ersetzt die frühere dauerhafte Chipliste und ist
  // deshalb standardmäßig geschlossen.
  const [isSectionManagerOpen, setSectionManagerOpen] = useState(false);

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
  const shuffleWords = useGameStore((state) => state.shuffleWords);
  const setShuffleWords = useGameStore((state) => state.setShuffleWords);
  const strictTypingMode = useGameStore((state) => state.strictTypingMode);
  const setStrictTypingMode = useGameStore((state) => state.setStrictTypingMode);
  const stationShuffle = useGameStore((state) => state.stationShuffle);
  const setStationShuffle = useGameStore((state) => state.setStationShuffle);

  const {
    roomCode,
    openLobbyError,
    results,
    studentsInLobby,
    connectedStudents,
    registeredStudents,
    studentVersions,
    hadTwoConnections,
    connectionWarning,
    liveProgress,
    stationStates,
    handleOpenLobby,
    handleStartSession,
    handleEndSession,
    handleRemoveStudent,
  } = useDashboardRoom({
    stepRef,
    setCurrentStep,
    wordsLength: words.length,
    clearWords: () => setWords([]),
  });

  // open_room() ist Voraussetzung für Phase 1 (siehe useDashboardRoom.ts) --
  // schlägt es fehl, bleibt currentStep bewusst auf SETTINGS statt LOBBY
  // hängen; hier nur sichtbar machen, was passiert ist.
  useEffect(() => {
    if (openLobbyError) alert(openLobbyError);
  }, [openLobbyError]);

  const math = useMathImport({ importMode, setWords });

  // Abschnitte reproduzierbar aus Rohtext + Regeln + manuellen Bereichen bauen
  // (siehe buildTextSections). Einzige Quelle für die Vorschau und den Marker.
  const textSections: TextSection[] = useMemo(
    () => (importMode === 'text' ? buildTextSections(rawText, splitConfig, manualRanges) : []),
    [importMode, rawText, splitConfig, manualRanges]
  );

  // Ergebnis-Ebene anwenden: Ausschlüsse + benutzerdefinierte Reihenfolge
  // (Rohtext bleibt unangetastet). Speist die Wortliste.
  const displaySections: TextSection[] = useMemo(
    () => applyResultEdits(textSections, excludedSectionIds, customOrder),
    [textSections, excludedSectionIds, customOrder]
  );

  // Für die Verwaltung: dieselbe Reihenfolge, aber MIT den ausgeschlossenen
  // Abschnitten – dort sollen sie sichtbar bleiben und wieder aufnehmbar sein.
  const orderedSections: TextSection[] = useMemo(
    () => applyResultEdits(textSections, [], customOrder),
    [textSections, customOrder]
  );

  // Ausschlüsse/Reihenfolge bei jeder Text-/Regel-/Bereichsänderung verwerfen
  // (Feinkonzept, Entscheidung E) – jeweils dort, wo die Änderung entsteht.
  const resetResultEdits = () => {
    setExcludedSectionIds([]);
    setCustomOrder([]);
  };

  // Im Text-Modus die Wörter aus den (bearbeiteten) Abschnitten spiegeln; der
  // Mathe-Modus schreibt die Wörter über seinen eigenen Effekt (useMathImport).
  useEffect(() => {
    if (importMode !== 'text') return;
    setWords(sectionsToWords(displaySections));
  }, [importMode, displaySections, setWords]);

  // Ausschließen = nur aus der Wortliste nehmen, der Rohtext bleibt vollständig.
  const handleToggleExclude = (id: string) =>
    setExcludedSectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleRestoreExcluded = () => setExcludedSectionIds([]);

  // Umsortieren wirkt ausschließlich auf die Reihenfolge der Wortliste. Basis ist
  // die vollständige Liste inklusive ausgeschlossener Abschnitte, weil die
  // Verwaltung genau diese anzeigt – sonst zeigten die Indizes ins Leere.
  const handleReorderSections = (fromIndex: number, toIndex: number) => {
    const ids = orderedSections.map((s) => s.id);
    setCustomOrder(moveArrayItem(ids, fromIndex, toIndex));
  };

  /** Merkt den aktuellen Stand der manuellen Bereiche für „rückgängig". */
  const pushManualHistory = () => setManualHistory((prev) => [...prev, manualRanges]);

  // Auswahl → genau ein Abschnitt. Überlappende manuelle Bereiche weichen dem
  // neuen (Feinkonzept: Überschneidungen ersetzen den alten Bereich).
  const handleAddSection = (start: number, end: number) => {
    pushManualHistory();
    setManualRanges((prev) => [
      ...prev.filter((r) => Math.max(start, r.start) >= Math.min(end, r.end)),
      { id: crypto.randomUUID(), type: 'section', start, end },
    ]);
    resetResultEdits();
  };

  const handleRemoveManualSection = (section: TextSection) => {
    pushManualHistory();
    setManualRanges((prev) =>
      prev.filter((r) => Math.max(section.start, r.start) >= Math.min(section.end, r.end))
    );
    resetResultEdits();
  };

  const handleClearManual = () => {
    pushManualHistory();
    setManualRanges([]);
    resetResultEdits();
  };

  // Nur die manuelle Ebene zurücknehmen – Rohtext sowie Zeichen- und
  // Enter-Einstellungen bleiben ausdrücklich unberührt.
  const handleUndoManual = () => {
    setManualHistory((prev) => {
      if (prev.length === 0) return prev;
      setManualRanges(prev[prev.length - 1]);
      resetResultEdits();
      return prev.slice(0, -1);
    });
  };

  // „Text leeren": Rohtext und alles daraus Abgeleitete. Die Regeln bleiben.
  const handleClearText = () => {
    setRawText('');
    setManualRanges([]);
    setManualHistory([]);
    setManualResetNotice(false);
    resetResultEdits();
  };

  // Regeländerung: manuelle Bereiche bleiben (Feinkonzept), aber Ausschlüsse und
  // Reihenfolge werden verworfen, da die Abschnittsgrenzen sich verschieben.
  const handleSplitConfigChange = (config: TextSplitConfig) => {
    setSplitConfig(config);
    resetResultEdits();
  };

  // Reset-Hinweis nach kurzer Zeit wieder ausblenden.
  useEffect(() => {
    if (!manualResetNotice) return;
    const t = setTimeout(() => setManualResetNotice(false), 4000);
    return () => clearTimeout(t);
  }, [manualResetNotice]);

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

  // Textänderung verwirft manuelle Bereiche (deren Positionen passen danach
  // evtl. nicht mehr) – anders als eine reine Regeländerung (Feinkonzept).
  const applyNewRawText = (value: string) => {
    if (manualRanges.length > 0) setManualResetNotice(true);
    setManualRanges([]);
    // Die Historie bezieht sich auf Positionen im alten Text und wäre danach
    // nicht mehr sinnvoll anwendbar.
    setManualHistory([]);
    resetResultEdits();
    setRawText(value.replace(/\r\n?/g, '\n'));
  };

  const handleRawTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyNewRawText(e.target.value);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) ?? '';
      if (importMode === 'math') {
        // Gleicher Eingabekanal wie Tippen/Einfügen in die Aufgabenliste. Zeilen
        // gleich säubern (Nummerierung, angehängtes "= Ergebnis" – normalizeMathLine),
        // damit die Liste nach dem Upload aufgeräumt ist statt roher Arbeitsblatt-Zeilen.
        const cleaned = text
          .replace(/\r\n?/g, '\n')
          .split('\n')
          .map(normalizeMathLine)
          .join('\n');
        math.handleMathInputChange(cleaned);
      } else {
        applyNewRawText(text);
      }
    };
    reader.readAsText(file);
    // Wählt die Lehrkraft dieselbe Datei erneut, feuert onChange sonst nicht.
    e.target.value = '';
  };

  const getStationStatus = (num: number): 'idle' | 'active' | 'done' => {
    const s = stationStates.get(num);
    if (!s) return 'idle';
    // finished wird beim ersten Ansehen des letzten Wortes gesetzt und bleibt
    // danach stehen, auch wenn der Schüler zurückblättert (siehe StationGame.tsx).
    if (s.finished) return 'done';
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
      nextDisabled: !stationMode && connectedStudents.size < 1,
      onNext: handleStartSession,
    },
    LIVE: {
      canBack: true,
      onBack: () => setCurrentStep('LOBBY'),
      nextLabel: 'Sitzung beenden',
      nextVariant: 'danger',
      onNext: handleEndSession,
      // In der Live-Sitzung zeigt der Footer statt der Versionsnummer den
      // Raum-Code (klickbar → großer QR-Code für Nachzügler).
      roomCode,
      showRoomCode: true,
    },
  };

  if (isSmallScreen && !forceMobileDashboard) {
    return <DashboardMobileWarning onContinueAnyway={() => setForceMobileDashboard(true)} />;
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-page text-ink overflow-x-hidden">
      {showOnboarding && <DashboardOnboarding onClose={dismissOnboarding} />}
      {isSectionManagerOpen && importMode === 'text' && (
        <SectionManager
          orderedSections={orderedSections}
          excludedIds={excludedSectionIds}
          onToggleExclude={handleToggleExclude}
          onReorder={handleReorderSections}
          onRestoreAll={handleRestoreExcluded}
          onClose={() => setSectionManagerOpen(false)}
        />
      )}
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
              onImportModeChange={setImportMode}
              rawText={rawText}
              onRawTextChange={handleRawTextChange}
              onFileUpload={handleFileUpload}
              onClearText={handleClearText}
              splitConfig={splitConfig}
              onSplitConfigChange={handleSplitConfigChange}
              sections={textSections}
              sectionCount={displaySections.length}
              manualRanges={manualRanges}
              manualResetNotice={manualResetNotice}
              canUndoManual={manualHistory.length > 0}
              onAddSection={handleAddSection}
              onRemoveManualSection={handleRemoveManualSection}
              onUndoManual={handleUndoManual}
              onClearManual={handleClearManual}
              onOpenSectionManager={() => setSectionManagerOpen(true)}
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
              shuffleWords={shuffleWords}
              onToggleShuffle={setShuffleWords}
              strictTypingMode={strictTypingMode}
              onToggleStrictTyping={setStrictTypingMode}
              stationShuffle={stationShuffle}
              onToggleStationShuffle={setStationShuffle}
            />
          )}

          {currentStep === 'LOBBY' && (
            <LobbyStep
              roomCode={roomCode}
              stationMode={stationMode}
              connectedStudents={Array.from(connectedStudents)}
              registeredStudents={registeredStudents}
              studentVersions={studentVersions}
              appVersion={APP_VERSION}
              connectionWarning={connectionWarning}
              hadTwoConnections={hadTwoConnections}
              onRetry={handleOpenLobby}
              onRemoveStudent={handleRemoveStudent}
            />
          )}

          {currentStep === 'LIVE' && (
            <LiveStep
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
    </div>
  );
};
