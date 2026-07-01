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
export const buildHint = (target: string, fraction: number): string => {
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
