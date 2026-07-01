/**
 * Sterne (1–5) – primär aus der Fehleranzahl. Alles richtig = 5 Sterne.
 * Bezugsgröße ist die Fehlerquote (Fehler pro Aufgabe).
 */
export const computeStars = (errors: number, wordCount: number): number => {
  if (wordCount <= 0 || errors <= 0) return 5;
  const rate = errors / wordCount;
  if (rate <= 0.15) return 4;
  if (rate <= 0.35) return 3;
  if (rate <= 0.6) return 2;
  return 1;
};

/**
 * Tempo-Punkte – je schneller, desto mehr. Normiert auf die Eingabelänge
 * (Zeichen pro Sekunde), damit lange Eingaben nicht benachteiligt werden.
 */
export const computeSpeedPoints = (totalLength: number, durationMs: number): number => {
  if (durationMs <= 0 || totalLength <= 0) return 0;
  const charsPerSecond = totalLength / (durationMs / 1000);
  return Math.max(0, Math.round(charsPerSecond * 100));
};
