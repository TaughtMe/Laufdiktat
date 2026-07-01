import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttackType, BattleOptions } from '../../types/game';

// Wie lange ein Angriff wirkt (ms) und wie schnell sich die Ladung füllt.
const ATTACK_DURATION_MS = 15000;
const CHARGE_PER_WORD = 25; // ~4 Wörter bis voll (schnelle Schüler)
const CHARGE_PER_WORD_SLOW = 34; // ~3 Wörter bis voll (Schüler, die hinten liegen)

export interface InkSplat {
  id: number;
  top: string;
  left: string;
  width: string;
  height: string;
  borderRadius: string;
  rotation: number;
}

const generateInkSplat = (): InkSplat => ({
  id: Math.random(),
  top: `${Math.random() * 40 + 30}%`,
  left: `${Math.random() * 60 + 20}%`,
  width: `${Math.random() * 80 + 80}px`,
  height: `${Math.random() * 60 + 60}px`,
  borderRadius: `${Math.random() * 30 + 40}% ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 30}% / ${Math.random() * 30 + 40}% ${Math.random() * 30 + 50}% ${Math.random() * 30 + 60}% ${Math.random() * 30 + 40}%`,
  rotation: Math.random() * 360,
});

interface UseBattleModeArgs {
  studentName: string | undefined;
  currentWordIndex: number;
  battleOptions: BattleOptions;
  bimanualLocked: boolean;
  roster: Record<string, number>;
  sendAttack: (to: string, type: AttackType) => boolean;
}

/**
 * Kapselt die Battle-Mechanik: Aufladebalken, Schild, aktiver Angriff,
 * Zielauswahl, Tinten-Overlay und Toasts. Verhalten unverändert gegenüber der
 * vorherigen Inline-Version in Game.tsx.
 */
export const useBattleMode = ({
  studentName,
  currentWordIndex,
  battleOptions,
  bimanualLocked,
  roster,
  sendAttack,
}: UseBattleModeArgs) => {
  const [charge, setCharge] = useState(0); // Aufladebalken 0..100
  const [shieldActive, setShieldActive] = useState(false); // Schild hoch (blockt nächsten Angriff)
  const [activeAttack, setActiveAttack] = useState<{ type: AttackType; until: number } | null>(null);
  const [picker, setPicker] = useState<AttackType | null>(null); // Zielauswahl offen für diesen Angriffstyp
  const [inkSplats, setInkSplats] = useState<InkSplat[]>([]);
  const [battleToast, setBattleToast] = useState<string | null>(null);

  // Refs für Werte, die in Channel-Callbacks aktuell sein müssen.
  const shieldRef = useRef(false);
  const activeAttackRef = useRef<{ type: AttackType; until: number } | null>(null);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { shieldRef.current = shieldActive; }, [shieldActive]);
  useEffect(() => { activeAttackRef.current = activeAttack; }, [activeAttack]);
  useEffect(() => () => {
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Kurze Battle-Hinweise ("Angriff geblockt" usw.). Stabil, damit es in
  // Channel-Callbacks und Aktionen gleichermaßen nutzbar ist.
  const showBattleToast = useCallback((msg: string) => {
    setBattleToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setBattleToast(null), 2500);
  }, []);

  // Ladegewinn pro Wort: Schüler, die (mind. zur Hälfte) hinter den anderen
  // liegen, laden etwas schneller – für Fairness, Fokus bleibt die Belohnung.
  const chargeGain = () => {
    const others = Object.entries(roster).filter(([n]) => n !== studentName);
    const total = others.length + 1;
    const ahead = others.filter(([, i]) => i > currentWordIndex).length;
    const isBehind = total > 1 && ahead >= total / 2;
    return isBehind ? CHARGE_PER_WORD_SLOW : CHARGE_PER_WORD;
  };

  /** Nach einem richtig gelösten Wort die Ladung füllen (nur Battle-Modus). */
  const fillCharge = () => setCharge((c) => Math.min(100, c + chargeGain()));

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

  // Eingehender Angriff: Schild blockt, sonst 15s wirken; nur einer gleichzeitig.
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

  // Welche Angriffsarten der Lehrer freigeschaltet hat (Fallback: beide).
  const availableAttacks: AttackType[] = [];
  if (battleOptions.ink) availableAttacks.push('ink');
  if (battleOptions.flicker) availableAttacks.push('flicker');
  if (availableAttacks.length === 0) availableAttacks.push('ink', 'flicker');

  const chargeReady = charge >= 100;
  const attackCandidates = picker ? getAttackCandidates() : [];
  // Flimmern nur, wenn gerade ein Flimmer-Angriff aktiv ist und das Wort gezeigt wird.
  const isFlickerActive = activeAttack?.type === 'flicker' && bimanualLocked;

  return {
    charge,
    chargeReady,
    shieldActive,
    activeAttack,
    picker,
    setPicker,
    inkSplats,
    battleToast,
    availableAttacks,
    attackCandidates,
    isFlickerActive,
    fillCharge,
    launchAttack,
    raiseShield,
    onAttack,
  };
};
