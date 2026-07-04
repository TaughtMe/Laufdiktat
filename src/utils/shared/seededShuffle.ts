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

// MurmurHash3-Finalizer (fmix32): starke Bit-Durchmischung ("Avalanche"), bei
// der schon ein einzelnes verändertes Bit im Schnitt die Hälfte der
// Ausgabe-Bits kippt. Ohne diesen Schritt hängt die *Reihenfolge* (nicht der
// Hash-Wert selbst!) fast nur von den letzten paar Bits des Index ab, weil
// deterministicOrder bisher `${seed}:${index}` hashte und der Index als
// einzelnes ASCII-Ziffernzeichen (0–9) ganz am Ende nur die unteren 4 Bit des
// FNV-Zwischenstands verändert – das reicht bei der linearen FNV-Mischung
// nicht aus, damit unterschiedliche Seeds auch unterschiedliche Reihenfolgen
// ergeben (führte dazu, dass viele Schüler denselben Shuffle bekamen).
const fmix32 = (x: number): number => {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
};

export const deterministicOrder = (n: number, seed: string): number[] => {
  const seedHash = hashStr(seed);
  return Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => fmix32(seedHash ^ fmix32(a)) - fmix32(seedHash ^ fmix32(b))
  );
};

/** Mischt `items` deterministisch anhand von `seed` (z. B. Raum+Schüler+Sitzung). */
export const seededShuffle = <T,>(items: T[], seed: string): T[] => {
  const order = deterministicOrder(items.length, seed);
  return order.map((i) => items[i]);
};
