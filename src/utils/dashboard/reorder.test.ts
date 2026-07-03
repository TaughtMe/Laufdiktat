import { describe, it, expect } from 'vitest';
import { moveArrayItem } from './reorder';

describe('moveArrayItem', () => {
  it('verschiebt ein Element nach vorne', () => {
    expect(moveArrayItem(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('verschiebt ein Element nach hinten', () => {
    expect(moveArrayItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('ist ein No-Op bei gleichem Index', () => {
    const items = ['a', 'b', 'c'];
    expect(moveArrayItem(items, 1, 1)).toBe(items);
  });

  it('ist ein No-Op bei Index außerhalb des Arrays', () => {
    const items = ['a', 'b', 'c'];
    expect(moveArrayItem(items, -1, 1)).toBe(items);
    expect(moveArrayItem(items, 1, 5)).toBe(items);
    expect(moveArrayItem(items, 5, 1)).toBe(items);
  });

  it('mutiert das Originalarray nicht', () => {
    const items = ['a', 'b', 'c', 'd'];
    const original = [...items];
    moveArrayItem(items, 3, 0);
    expect(items).toEqual(original);
  });
});
