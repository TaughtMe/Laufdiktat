import { describe, it, expect } from 'vitest';
import { computeStars, computeSpeedPoints } from './scoring';

describe('computeStars', () => {
  it('gibt 5 Sterne ohne Fehler', () => {
    expect(computeStars(0, 10)).toBe(5);
    expect(computeStars(0, 0)).toBe(5);
  });

  it('staffelt nach Fehlerquote', () => {
    expect(computeStars(1, 10)).toBe(4); // 0.10
    expect(computeStars(3, 10)).toBe(3); // 0.30
    expect(computeStars(5, 10)).toBe(2); // 0.50
    expect(computeStars(7, 10)).toBe(1); // 0.70
  });
});

describe('computeSpeedPoints', () => {
  it('ist höher bei mehr Zeichen pro Sekunde', () => {
    expect(computeSpeedPoints(10, 5000)).toBe(200); // 2 Zeichen/s * 100
    expect(computeSpeedPoints(20, 5000)).toBeGreaterThan(computeSpeedPoints(10, 5000));
  });

  it('ist 0 bei fehlenden Werten', () => {
    expect(computeSpeedPoints(0, 1000)).toBe(0);
    expect(computeSpeedPoints(10, 0)).toBe(0);
  });
});
