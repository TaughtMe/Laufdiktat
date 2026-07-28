import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebounced } from './debounce';

describe('createDebounced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('feuert delayMs nach dem letzten Aufruf (klassisches Trailing-Debounce)', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, { delayMs: 300, maxWaitMs: 2000 });

    d.schedule();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('bündelt dicht aufeinanderfolgende Aufrufe zu einem einzigen', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, { delayMs: 300, maxWaitMs: 2000 });

    d.schedule();
    vi.advanceTimersByTime(100);
    d.schedule();
    vi.advanceTimersByTime(100);
    d.schedule();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('feuert trotz Dauerfeuer spätestens nach maxWaitMs (kein Aushungern)', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, { delayMs: 300, maxWaitMs: 2000 });

    // Ereignisse alle 100ms -- ein reines Trailing-Debounce würde NIE feuern.
    for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
      d.schedule();
      vi.advanceTimersByTime(100);
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('beginnt nach einem Lauf eine frische maxWait-Welle', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, { delayMs: 300, maxWaitMs: 2000 });

    // Erste Welle: Dauerfeuer bis maxWait feuert.
    for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
      d.schedule();
      vi.advanceTimersByTime(100);
    }
    expect(fn).toHaveBeenCalledTimes(1);

    // Zweite Welle: ruhiges Einzelereignis -> normales Debounce-Verhalten.
    d.schedule();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel verwirft einen ausstehenden Aufruf', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, { delayMs: 300, maxWaitMs: 2000 });

    d.schedule();
    d.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('nach cancel ist ein erneutes schedule wieder möglich', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, { delayMs: 300, maxWaitMs: 2000 });

    d.schedule();
    d.cancel();
    d.schedule();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
