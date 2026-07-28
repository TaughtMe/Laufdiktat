// Zielauswahl im Battle-Modus: Wen darf ein Schüler angreifen?
// Als pure Funktion aus useBattleMode.ts extrahiert, damit die Auswahllogik
// ohne Live-Klasse testbar ist (siehe attackCandidates.test.ts).

export interface AttackCandidate {
  name: string;
  index: number;
}

/**
 * Bis zu 3 Angriffsziele: Mitspieler, die weiter oder GLEICH weit sind
 * (nächste zuerst). Wer selbst (mit-)führt, sieht die 3 direkt dahinter --
 * einschließlich gleichauf Führender, damit sich zwei punktgleiche
 * Spitzenreiter gegenseitig angreifen können statt unangreifbar zu sein.
 */
export const pickAttackCandidates = (
  roster: Record<string, number>,
  studentName: string | undefined,
  currentWordIndex: number
): AttackCandidate[] => {
  const others = Object.entries(roster)
    .filter(([n]) => n !== studentName)
    .map(([name, index]) => ({ name, index }));
  if (others.length === 0) return [];

  const maxIndex = Math.max(currentWordIndex, ...others.map((o) => o.index));
  if (currentWordIndex >= maxIndex) {
    // Führender (ggf. gleichauf): gleich weite Mitspieler zuerst, dann die
    // nächsten dahinter.
    return others
      .filter((o) => o.index <= currentWordIndex)
      .sort((a, b) => b.index - a.index)
      .slice(0, 3);
  }
  return others
    .filter((o) => o.index >= currentWordIndex)
    .sort((a, b) => a.index - b.index)
    .slice(0, 3);
};
