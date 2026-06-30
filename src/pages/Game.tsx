import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, GameMetrics, AttackType, WordItem } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { StationGame } from './StationGame';
import { ExitConfirm, SessionEndedOverlay } from '../components/GameOverlays';
import { useExitGuard } from '../hooks/useExitGuard';
import { useGameRoom, type SessionStartData } from '../hooks/useGameRoom';
import { LegalLink } from '../components/LegalLink';
import { computeStars, computeSpeedPoints } from '../utils/scoring';

interface InkSplat {
  id: number;
  top: string;
  left: string;
  width: string;
  height: string;
  borderRadius: string;
  rotation: number;
}

// Wie lange ein Angriff wirkt (ms) und wie schnell sich die Ladung füllt.
const ATTACK_DURATION_MS = 15000;
const CHARGE_PER_WORD = 25;        // ~4 Wörter bis voll (schnelle Schüler)
const CHARGE_PER_WORD_SLOW = 34;   // ~3 Wörter bis voll (Schüler, die hinten liegen)

// Prüft eine Eingabe: bei Mathe (item.prompt gesetzt) numerisch, sonst als Text.
const checkAnswer = (item: WordItem, input: string): boolean => {
  const val = input.trim();
  if (item.prompt) {
    if (val === '') return false;
    const n = parseFloat(val.replace(',', '.'));
    return !Number.isNaN(n) && n === Number(item.targetWord);
  }
  return val === item.targetWord;
};

const generateInkSplat = (): InkSplat => ({
  id: Math.random(),
  top: `${Math.random() * 40 + 30}%`,
  left: `${Math.random() * 60 + 20}%`,
  width: `${Math.random() * 80 + 80}px`,
  height: `${Math.random() * 60 + 60}px`,
  borderRadius: `${Math.random() * 30 + 40}% ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 30}% / ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 60}% ${Math.random() * 30 + 40}%`,
  rotation: Math.random() * 360,
});

// Stabiler Hash + deterministische "Zufalls"-Reihenfolge, damit ein Hinweis
// bei jedem Render gleich aussieht (kein Flackern).
const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const deterministicOrder = (n: number, seed: string): number[] =>
  Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => hashStr(`${seed}:${a}`) - hashStr(`${seed}:${b}`)
  );

/**
 * Baut den Hinweis für Freies Üben.
 * fraction (0..1) = wie viel schon aufgedeckt ist.
 * Einzelwort  -> einzelne Buchstaben werden nach und nach gezeigt, Rest "_".
 * Satz (Leerz.) -> ganze Wörter werden nach und nach gezeigt, Rest maskiert.
 */
const buildHint = (target: string, fraction: number): string => {
  const isSentence = target.trim().includes(' ');
  if (isSentence) {
    const tokens = target.split(/(\s+)/); // Trenner behalten
    const wordPositions = tokens
      .map((t, i) => (t.trim() !== '' ? i : -1))
      .filter((i) => i >= 0);
    const revealCount = Math.ceil(wordPositions.length * fraction);
    const order = deterministicOrder(wordPositions.length, target);
    const revealed = new Set(order.slice(0, revealCount).map((k) => wordPositions[k]));
    return tokens
      .map((t, i) => (t.trim() === '' ? t : revealed.has(i) ? t : t.replace(/\S/g, '_')))
      .join('');
  }
  const chars = [...target];
  const letterIdx = chars.map((c, i) => ({ c, i })).filter((x) => x.c.trim() !== '').map((x) => x.i);
  const revealCount = Math.ceil(letterIdx.length * fraction);
  const order = deterministicOrder(letterIdx.length, target);
  const revealed = new Set(order.slice(0, revealCount).map((k) => letterIdx[k]));
  return chars.map((c, i) => (c.trim() === '' ? c : revealed.has(i) ? c : '_')).join(' ');
};

export const Game = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Einmalig festhalten: ein Browser-/Geräte-Zurück löst einen popstate aus,
  // bei dem location.state (und damit der Raum-Code) verloren ginge.
  const [roomCode] = useState<string | undefined>(() => (location.state as { roomCode?: string } | null)?.roomCode);
  const [studentName] = useState<string | undefined>(() => (location.state as { studentName?: string } | null)?.studentName);

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
  const uebungMaxAttempts = useGameStore((state) => state.uebungMaxAttempts);
  const setUebungMaxAttempts = useGameStore((state) => state.setUebungMaxAttempts);
  const showStars = useGameStore((state) => state.showStars);
  const setShowStars = useGameStore((state) => state.setShowStars);

  // Auswertung: Startzeit, Gesamtfehler und Fehler je Aufgabe (für Lehrer-Statistik).
  const startedAtRef = useRef(0);
  const errorsRef = useRef(0);
  const wordErrorsRef = useRef<Record<string, number>>({});

  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [metrics, setMetrics] = useState<GameMetrics>({ peeks: 0, attempts: 0 });
  const [finalDurationMs, setFinalDurationMs] = useState(0);
  const [errorShake, setErrorShake] = useState(false);
  // Freies Üben: Fehlversuche beim aktuellen Wort + Abtipp-Phase.
  const [wrongCount, setWrongCount] = useState(0);
  const [copyMode, setCopyMode] = useState(false);
  // Verlassen-Bestätigung & "Sitzung beendet"-Hinweis.
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  // Das erste Aufdecken eines Wortes ist erlaubt und zählt nicht als Spicker.
  const [revealedCurrentWord, setRevealedCurrentWord] = useState(false);

  // Lokale Interferenz-States (durch eingehende Angriffe ausgelöst)
  const [inkSplats, setInkSplats] = useState<InkSplat[]>([]);

  // --- Battle-Modus: Mehrspieler-Mechanik ---
  const [charge, setCharge] = useState(0);                 // Aufladebalken 0..100
  const [shieldActive, setShieldActive] = useState(false); // Schild hoch (blockt nächsten Angriff)
  const [activeAttack, setActiveAttack] = useState<{ type: AttackType; until: number } | null>(null);
  const [picker, setPicker] = useState<AttackType | null>(null); // Zielauswahl offen für diesen Angriffstyp
  const [battleToast, setBattleToast] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const karaokeRef = useRef<HTMLDivElement>(null);
  // Refs für Werte, die in Channel-Callbacks aktuell sein müssen.
  const shieldRef = useRef(false);
  const activeAttackRef = useRef<{ type: AttackType; until: number } | null>(null);
  const currentWordIndexRef = useRef(0);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { shieldRef.current = shieldActive; }, [shieldActive]);
  useEffect(() => { activeAttackRef.current = activeAttack; }, [activeAttack]);
  useEffect(() => { currentWordIndexRef.current = currentWordIndex; }, [currentWordIndex]);

  // Derived state that needs to be calculated before effects
  const totalLength = words.reduce((acc, word) => acc + word.targetWord.length, 0);
  const currentWord = words[currentWordIndex] || { targetWord: '' };
  const isMath = !!currentWord.prompt;
  const displayPrompt = currentWord.prompt ?? currentWord.targetWord;

  // Kurze Battle-Hinweise ("Angriff geblockt" usw.). Stabil, damit es in
  // Channel-Callbacks und Aktionen gleichermaßen nutzbar ist.
  const showBattleToast = useCallback((msg: string) => {
    setBattleToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setBattleToast(null), 2500);
  }, []);

  // Eingehende Sitzung übernehmen (neue Runde -> alles zurücksetzen).
  const onSessionStart = useCallback((data: SessionStartData) => {
    const { words: newWords, gameMode: newMode, battleOptions: newOptions, stationMode: newStationMode, stationCount: newStationCount, isTtsEnabled: newTtsEnabled, uebungMaxAttempts: newMaxAttempts, showStars: newShowStars } = data;
    setSessionEnded(false);
    setCurrentWordIndex(0);
    setGameState('IDLE');
    // Auswertung für die neue Runde zurücksetzen.
    startedAtRef.current = 0;
    errorsRef.current = 0;
    wordErrorsRef.current = {};
    setWords(newWords);
    setGameMode(newMode);
    setBattleOptions(newOptions);
    if (newStationMode !== undefined) setStationMode(newStationMode);
    if (newStationCount !== undefined) setStationCount(newStationCount);
    if (newTtsEnabled !== undefined) setTtsEnabled(newTtsEnabled);
    if (newMaxAttempts !== undefined) setUebungMaxAttempts(newMaxAttempts);
    if (newShowStars !== undefined) setShowStars(newShowStars);
  }, [setWords, setGameMode, setBattleOptions, setStationMode, setStationCount, setTtsEnabled, setUebungMaxAttempts, setShowStars]);

  const onSessionEnded = useCallback(() => {
    setSessionEnded(true);
  }, []);

  // Eingehender Angriff (Battle): Schild blockt, sonst 15s wirken; nur einer gleichzeitig.
  const onAttack = useCallback((type: AttackType) => {
    if (shieldRef.current) {
      setShieldActive(false);
      showBattleToast('🛡️ Angriff geblockt!');
      return;
    }
    if (activeAttackRef.current && activeAttackRef.current.until > Date.now()) return;

    setActiveAttack({ type, until: Date.now() + ATTACK_DURATION_MS });
    showBattleToast(type === 'ink' ? '🖋️ Tinten-Angriff!' : '✨ Flimmer-Angriff!');
    if (type === 'ink') {
      setInkSplats([generateInkSplat(), generateInkSplat(), generateInkSplat()]);
    }
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    attackTimerRef.current = setTimeout(() => {
      setActiveAttack(null);
      setInkSplats([]);
    }, ATTACK_DURATION_MS);
  }, [showBattleToast]);

  const { connectionWarning, roster, sendProgress, sendFinished, sendAttack } = useGameRoom({
    roomCode,
    studentName,
    currentWordIndexRef,
    onSessionStart,
    onSessionEnded,
    onAttack,
  });

  // Timer (Angriff/Toast) beim Unmount aufräumen.
  useEffect(() => () => {
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    if (bimanualLocked) {
      inputRef.current?.blur();
    } else if (gameState === 'WRITING') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [bimanualLocked, gameState]);

  useEffect(() => {
    if (gameState !== 'FINISHED') return;
    // Dauer einmalig beim Abschluss festhalten (für Tempo-Punkte im Endscreen).
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    setFinalDurationMs(durationMs);
    // Ergebnis ans Lehrer-Dashboard senden (no-op, falls kein Channel/Raum).
    sendFinished({
      name: studentName,
      peeks: metrics.peeks,
      attempts: metrics.attempts,
      errors: errorsRef.current,
      durationMs,
      totalLength,
      wordCount: words.length,
      wordErrors: wordErrorsRef.current,
    });
  }, [gameState, studentName, metrics.peeks, metrics.attempts, totalLength, words.length, sendFinished]);

  // Geräte-/Browser-Zurück abfangen, solange das Spiel läuft.
  const requestExit = useCallback(() => setShowExitConfirm(true), []);
  useExitGuard(!sessionEnded && gameState !== 'FINISHED' && !!roomCode, requestExit);

  // Abtipp-Phase: aktiven Buchstaben mittig in den Blick scrollen (Karaoke).
  useEffect(() => {
    if (!copyMode) return;
    const el = karaokeRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [inputValue, copyMode]);

  // Station mode: delegate to separate component (AFTER all hooks)
  if (stationMode) return <StationGame />;

  // Lehrkraft hat die Sitzung beendet → Hinweis mit Zurück-Button.
  if (sessionEnded) return <SessionEndedOverlay onBack={() => navigate('/')} />;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState === 'FINISHED' || words.length === 0) return;

    // Zeitmessung beginnt bei der ersten Interaktion.
    if (startedAtRef.current === 0) startedAtRef.current = Date.now();

    if (e.touches.length >= 2) {
      if (!bimanualLocked) {
        // Erstes Ansehen des aktuellen Wortes zählt nicht als Spicker.
        if (revealedCurrentWord) {
          setMetrics((prev) => ({ ...prev, peeks: prev.peeks + 1 }));
        } else {
          setRevealedCurrentWord(true);
        }
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

  // Ladegewinn pro Wort: Schüler, die (mind. zur Hälfte) hinter den anderen
  // liegen, laden etwas schneller – für Fairness, Fokus bleibt die Belohnung.
  const chargeGain = () => {
    const others = Object.entries(roster).filter(([n]) => n !== studentName);
    const total = others.length + 1;
    const ahead = others.filter(([, i]) => i > currentWordIndex).length;
    const isBehind = total > 1 && ahead >= total / 2;
    return isBehind ? CHARGE_PER_WORD_SLOW : CHARGE_PER_WORD;
  };

  // Bis zu 3 Angriffsziele: Mitspieler, die weiter oder gleich weit sind
  // (nächste zuerst). Wer selbst führt, sieht die 3 direkt dahinter.
  const getAttackCandidates = (): Array<{ name: string; index: number }> => {
    const others = Object.entries(roster)
      .filter(([n]) => n !== studentName)
      .map(([name, index]) => ({ name, index }));
    if (others.length === 0) return [];
    const maxIndex = Math.max(currentWordIndex, ...others.map((o) => o.index));
    if (currentWordIndex >= maxIndex) {
      return others
        .filter((o) => o.index < currentWordIndex)
        .sort((a, b) => b.index - a.index)
        .slice(0, 3);
    }
    return others
      .filter((o) => o.index >= currentWordIndex)
      .sort((a, b) => a.index - b.index)
      .slice(0, 3);
  };

  const launchAttack = (targetName: string) => {
    if (!picker) return;
    if (!sendAttack(targetName, picker)) return;
    setCharge(0);
    setPicker(null);
    showBattleToast(`Angriff auf ${targetName} gestartet!`);
  };

  const raiseShield = () => {
    if (charge < 100) return;
    setShieldActive(true);
    setCharge(0);
    showBattleToast('🛡️ Schild aktiviert');
  };

  // Freies Üben: Aufgabe/Wort vorlesen. Zählt – wie ein Blick – als Spicker.
  const speakWord = () => {
    if (!displayPrompt) return;
    // Bei Mathe die Symbole für die Sprachausgabe in Worte umwandeln.
    const spoken = isMath
      ? displayPrompt
          .replace(/\+/g, ' plus ')
          .replace(/[−-]/g, ' minus ')
          .replace(/[·*×]/g, ' mal ')
          .replace(/[:/÷]/g, ' geteilt durch ')
      : displayPrompt;
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'de-DE';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setMetrics((prev) => ({ ...prev, peeks: prev.peeks + 1 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameState !== 'WRITING' || words.length === 0) return;

    setMetrics((prev) => ({ ...prev, attempts: prev.attempts + 1 }));

    if (checkAnswer(currentWord, inputValue)) {
      // Mitspielern den neuen Fortschritt mitteilen (für Battle-Zielauswahl).
      const newIndex = currentWordIndex + 1;
      sendProgress(newIndex);
      // Battle-Modus: Aufladebalken füllen (langsamere Schüler etwas schneller).
      if (gameMode === 'BATTLE') {
        setCharge((c) => Math.min(100, c + chargeGain()));
      }

      if (currentWordIndex + 1 < words.length) {
        setCurrentWordIndex((prev) => prev + 1);
        setInputValue('');
        setGameState('IDLE');
        // Nächstes Wort: erstes Ansehen wieder kostenlos, Hilfe zurücksetzen.
        setRevealedCurrentWord(false);
        setWrongCount(0);
        setCopyMode(false);
      } else {
        setGameState('FINISHED');
      }
    } else {
      // Fehler erfassen (gesamt + je Aufgabe für die Lehrer-Statistik).
      errorsRef.current += 1;
      const key = currentWord.prompt ?? currentWord.targetWord;
      wordErrorsRef.current[key] = (wordErrorsRef.current[key] || 0) + 1;

      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);

      if (gameMode === 'UEBUNG') {
        if (!copyMode) {
          const nextWrong = wrongCount + 1;
          setWrongCount(nextWrong);
          setInputValue('');
          // Ab der eingestellten Anzahl Fehlversuche: ganzes Wort zum Abtippen.
          if (nextWrong >= uebungMaxAttempts) setCopyMode(true);
        }
        // In der Abtipp-Phase die Eingabe NICHT löschen – Tippfehler korrigierbar.
      } else {
        setInputValue('');
      }

      inputRef.current?.focus();
    }
  };

  // Flimmern nur, wenn gerade ein Flimmer-Angriff aktiv ist und das Wort gezeigt wird.
  const isFlickerActive = activeAttack?.type === 'flicker' && bimanualLocked;

  // --- Freies Üben: Hinweis-/Abtipp-Anzeige ---
  const target = currentWord.targetWord;
  const showHint = gameMode === 'UEBUNG' && !copyMode && wrongCount > 0 && !isMath;
  const hintText = showHint ? buildHint(target, wrongCount / uebungMaxAttempts) : '';
  // Länge des korrekt getippten Anfangs (für grünes Karaoke-Feedback).
  let correctPrefixLen = 0;
  while (
    correctPrefixLen < inputValue.length &&
    correctPrefixLen < target.length &&
    inputValue[correctPrefixLen] === target[correctPrefixLen]
  ) {
    correctPrefixLen++;
  }

  // Welche Angriffsarten der Lehrer freigeschaltet hat (Fallback: beide).
  const availableAttacks: AttackType[] = [];
  if (battleOptions.ink) availableAttacks.push('ink');
  if (battleOptions.flicker) availableAttacks.push('flicker');
  if (availableAttacks.length === 0) availableAttacks.push('ink', 'flicker');

  const chargeReady = charge >= 100;
  const attackCandidates = picker ? getAttackCandidates() : [];

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
          {showExitConfirm && (
            <ExitConfirm onConfirm={() => navigate('/')} onCancel={() => setShowExitConfirm(false)} />
          )}
          <LegalLink dark className="absolute bottom-4 left-1/2 -translate-x-1/2" />
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
            onClick={() => { if (gameState === 'FINISHED') { navigate('/'); } else { setShowExitConfirm(true); } }}
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
          <span>Fehler: {Math.max(0, metrics.attempts - (gameState === 'FINISHED' ? words.length : currentWordIndex))}</span>
        </div>
      </header>

      {/* Battle-HUD: Aufladebalken + Angriffe/Schild (oben) */}
      {gameMode === 'BATTLE' && gameState !== 'FINISHED' && (
        <div className="px-6 pb-3 z-20">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm flex flex-col gap-2.5">
            {/* Aufladebalken */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-14 shrink-0">Ladung</span>
              <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${chargeReady ? 'bg-[#5efcc2]' : 'bg-brand-500'}`}
                  style={{ width: `${charge}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-300 w-9 text-right">{Math.round(charge)}%</span>
            </div>

            {/* Aktions-Buttons */}
            <div className="flex items-center gap-2">
              {availableAttacks.includes('ink') && (
                <button
                  type="button"
                  disabled={!chargeReady}
                  onClick={(e) => { e.stopPropagation(); setPicker('ink'); }}
                  className="flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-white/20 enabled:active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                >
                  🖋️ Tinte
                </button>
              )}
              {availableAttacks.includes('flicker') && (
                <button
                  type="button"
                  disabled={!chargeReady}
                  onClick={(e) => { e.stopPropagation(); setPicker('flicker'); }}
                  className="flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-white/20 enabled:active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                >
                  ✨ Flimmern
                </button>
              )}
              <button
                type="button"
                disabled={!chargeReady || shieldActive}
                onClick={(e) => { e.stopPropagation(); raiseShield(); }}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${shieldActive ? 'bg-[#5efcc2] text-[#004730]' : 'bg-white/10 text-white enabled:hover:bg-white/20'}`}
              >
                🛡️ {shieldActive ? 'Schild aktiv' : 'Schild'}
              </button>
            </div>

            {/* Statusanzeige */}
            {activeAttack && (
              <div className="text-center text-[11px] font-bold text-red-300 animate-pulse">
                {activeAttack.type === 'ink' ? 'Tinten-Angriff aktiv!' : 'Flimmer-Angriff aktiv!'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kurze Battle-Hinweise */}
      {battleToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-sm font-bold px-5 py-2.5 rounded-full border border-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          {battleToast}
        </div>
      )}

      {/* Ziel-Auswahl für einen Angriff */}
      {picker && (
        <div
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={(e) => { e.stopPropagation(); setPicker(null); }}
        >
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-center mb-1">
              {picker === 'ink' ? '🖋️ Tinten-Angriff' : '✨ Flimmer-Angriff'}
            </h3>
            <p className="text-slate-400 text-xs text-center mb-4">Wähle dein Ziel</p>
            {attackCandidates.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Noch keine Mitspieler in Reichweite.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {attackCandidates.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); launchAttack(c.name); }}
                    className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/15 text-white font-bold text-sm transition-colors active:scale-[0.98] cursor-pointer flex items-center justify-between"
                  >
                    <span>{c.name}</span>
                    <span className="text-[11px] text-slate-400 font-medium">Wort {c.index + 1}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPicker(null); }}
              className="w-full mt-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 relative flex items-center justify-center p-4">
        {/* Freies Üben: Vorlesen-Button, von Anfang an sichtbar und drückbar
            (außerhalb des Doppel-Touch-Bereichs). Zählt als Spicker. */}
        {gameMode === 'UEBUNG' && isTtsEnabled && gameState !== 'FINISHED' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); speakWord(); }}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold px-4 py-2.5 rounded-full border border-white/10 backdrop-blur-sm transition-colors active:scale-95 cursor-pointer"
            title="Wort vorlesen (zählt als Spicker)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
            <span>Vorlesen</span>
          </button>
        )}

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
                  {displayPrompt}
                </h2>
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
              {/* Freies Üben: Hinweis (Striche → Buchstaben) bzw. Abtipp-Vorlage */}
              {gameMode === 'UEBUNG' && (copyMode || showHint) && (
                <div className="mb-5 text-center">
                  {copyMode ? (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#5efcc2] mb-2">
                        Tippe das Wort ab
                      </p>
                      <div ref={karaokeRef} className="max-w-full overflow-x-auto whitespace-nowrap py-1">
                        {[...target].map((ch, i) => (
                          <span
                            key={i}
                            data-active={i === correctPrefixLen ? 'true' : undefined}
                            className={`text-3xl sm:text-4xl font-black transition-colors duration-150 ${
                              i < correctPrefixLen ? 'text-emerald-400/40' : 'text-white'
                            }`}
                          >
                            {ch === ' ' ? ' ' : ch}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Tipp ({wrongCount}/{uebungMaxAttempts})
                      </p>
                      <p className="text-3xl sm:text-4xl font-black text-slate-300 tracking-[0.15em] break-words">
                        {hintText}
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode={isMath ? 'numeric' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className={`w-full text-center text-4xl font-bold py-6 px-4 bg-white/10 backdrop-blur-sm border-4 ${
                    errorShake
                      ? 'border-red-500 text-red-400'
                      : 'border-brand-500 text-white focus:ring-brand-500/20'
                  } rounded-[1.8rem] shadow-[0_10px_35px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-4 transition-all relative z-10 font-sans tracking-wide placeholder:text-slate-500`}
                  placeholder={copyMode ? 'Hier abtippen...' : isMath ? 'Ergebnis...' : 'Wort eingeben...'}
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

              {showStars && (() => {
                const stars = computeStars(metrics.attempts - words.length, words.length);
                const speed = computeSpeedPoints(totalLength, finalDurationMs);
                return (
                  <div className="mt-8 w-full">
                    <div className="bg-white/10 backdrop-blur-sm px-6 py-5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] border border-white/10 flex flex-col items-center">
                      <div className="text-3xl tracking-wide" aria-label={`${stars} von 5 Sternen`}>
                        <span className="text-amber-400">{'★'.repeat(stars)}</span><span className="text-white/20">{'★'.repeat(5 - stars)}</span>
                      </div>
                      <div className="mt-3 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                        Tempo
                      </div>
                      <div className="text-3xl font-black text-brand-400">{speed}</div>
                    </div>
                  </div>
                );
              })()}

              {showStars && (
                <div className="mt-4 w-full flex justify-between gap-3 text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl">
                  <span>Spicker gesamt: {metrics.peeks}</span>
                  <span>Fehler gesamt: {Math.max(0, metrics.attempts - words.length)}</span>
                </div>
              )}

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
      </main>

      {showExitConfirm && (
        <ExitConfirm
          onConfirm={() => navigate('/')}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
      <LegalLink dark className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-40" />
    </div>
  );
};

