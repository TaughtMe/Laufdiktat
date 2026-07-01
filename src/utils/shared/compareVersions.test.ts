import { describe, it, expect } from 'vitest';
import { compareVersions } from './compareVersions';

describe('compareVersions', () => {
  it('gibt 0 bei gleichen Versionen zurück', () => {
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('erkennt eine neuere Patch-Version', () => {
    expect(compareVersions('2.0.1', '2.0.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '2.0.1')).toBeLessThan(0);
  });

  it('erkennt eine neuere Minor-/Major-Version', () => {
    expect(compareVersions('2.1.0', '2.0.9')).toBeGreaterThan(0);
    expect(compareVersions('3.0.0', '2.9.9')).toBeGreaterThan(0);
  });

  it('behandelt fehlende Teile als 0', () => {
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('2.1', '2.0.5')).toBeGreaterThan(0);
  });
});
