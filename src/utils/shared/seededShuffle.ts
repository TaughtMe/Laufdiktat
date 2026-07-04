// Stabiler Hash + deterministische "Zufalls"-Reihenfolge/-Mischung. Gleicher
// Seed -> immer dieselbe Reihenfolge (kein Flackern bei Re-Renders, gleiche
// Reihenfolge nach einem Reload). Wird sowohl für Hinweis-Aufdeckung
// (buildHint) als auch für den Shuffle-Modus (pro Schüler stabil gemischte
// Wortliste) genutzt.

// FNV-1a: einfacher Hash mit deutlich besserer Durchmischung als ein simples
// Rolling-Hash (h*31+c) – wichtig, damit sich ähnliche Seeds (z. B. Namen
// gleicher Länge wie "Schueler-A"/"Schueler-B") bei kleinen Wortlisten nicht
// zufällig auf dieselbe Reihenfolge abbilden.
export const hashStr = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const deterministicOrder = (n: number, seed: string): number[] =>
  Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => hashStr(`${seed}:${a}`) - hashStr(`${seed}:${b}`)
  );

/** Mischt `items` deterministisch anhand von `seed` (z. B. Raum+Schüler+Sitzung). */
export const seededShuffle = <T,>(items: T[], seed: string): T[] => {
  const order = deterministicOrder(items.length, seed);
  return order.map((i) => items[i]);
};
