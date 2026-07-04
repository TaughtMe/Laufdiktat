import { describe, it, expect } from 'vitest';
import { hashStr, deterministicOrder, seededShuffle } from './seededShuffle';

describe('hashStr', () => {
  it('ist deterministisch (gleicher Input -> gleicher Hash)', () => {
    expect(hashStr('foo')).toBe(hashStr('foo'));
  });

  it('unterscheidet verschiedene Strings (in der Praxis)', () => {
    expect(hashStr('foo')).not.toBe(hashStr('bar'));
  });
});

describe('deterministicOrder', () => {
  it('ist deterministisch bei gleichem Seed', () => {
    expect(deterministicOrder(10, 'raum-4172')).toEqual(deterministicOrder(10, 'raum-4172'));
  });

  it('liefert eine echte Permutation von 0..n-1', () => {
    const order = deterministicOrder(6, 'seed-a');
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('liefert bei unterschiedlichem Seed in der Regel eine andere Reihenfolge', () => {
    const a = deterministicOrder(8, 'schueler-a');
    const b = deterministicOrder(8, 'schueler-b');
    expect(a).not.toEqual(b);
  });

  it('gibt [] bei n=0 zurück', () => {
    expect(deterministicOrder(0, 'irgendwas')).toEqual([]);
  });

  // Regressionstest: Ein einzelnes Seed-Paar reicht nicht, um eine schlechte
  // Durchmischung zu erkennen (ein früherer Bug ließ ~50% realistischer
  // Schülernamen auf dieselbe Reihenfolge kollidieren, obwohl ein einzelnes
  // Testpaar zufällig unterschiedlich ausfiel). Deshalb hier viele Seeds mit
  // realistischer Form (Raum:Name:Sitzung) prüfen.
  it('erzeugt für viele realistische Schüler-Seeds überwiegend unterschiedliche Reihenfolgen', () => {
    const names = [
      'Flinker Dackel', 'Wilder Bär', 'Schneller Fuchs', 'Kluger Igel', 'Mutiger Löwe',
      'Freche Robbe', 'Stille Eule', 'Neugieriges Erdmaennchen', 'Schlaues Capybara', 'Frecher Igel',
      'Zebra-Fan', 'Koala-Freund', 'Tiger-Team', 'Adler-Auge', 'Pandabaer',
    ];
    const orders = new Set(names.map((name) => deterministicOrder(8, `4172:${name}:session-1`).join(',')));
    // Bei guter Durchmischung sind fast alle Reihenfolgen verschieden; ein paar
    // zufällige Kollisionen unter 15 Namen (8! Möglichkeiten) sind normal,
    // eine Kollisionsrate wie beim Bug (nur 5 von 10 eindeutig) darf es nicht
    // mehr geben.
    expect(orders.size).toBeGreaterThanOrEqual(names.length - 1);
  });
});

describe('seededShuffle', () => {
  const words = ['Elefant', 'Giraffe', 'Nashorn', 'Zebra'];

  it('enthält dieselben Elemente, nur umsortiert', () => {
    const shuffled = seededShuffle(words, 'raum-4172:Frecher-Igel:session-1');
    expect([...shuffled].sort()).toEqual([...words].sort());
  });

  it('ist stabil bei gleichem Seed (überlebt einen Reload)', () => {
    const seed = 'raum-4172:Frecher-Igel:session-1';
    expect(seededShuffle(words, seed)).toEqual(seededShuffle(words, seed));
  });

  it('mischt unterschiedliche Schüler (verschiedener Name im Seed) meist unterschiedlich', () => {
    const a = seededShuffle(words, 'raum-4172:Frecher-Igel:session-1');
    const b = seededShuffle(words, 'raum-4172:Schlaues-Capybara:session-1');
    expect(a).not.toEqual(b);
  });

  it('liefert bei leerem Array [] zurück', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
  });
});
