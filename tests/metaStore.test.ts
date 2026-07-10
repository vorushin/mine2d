import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { MetaStore, starCoinsForRun, priceOf } from '../src/systems/MetaStore';

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
      },
    });
  }
});

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

describe('starCoinsForRun', () => {
  it('adds up nights, bosses, depth, graveyards, and the victory bonus', () => {
    expect(starCoinsForRun({ nights: 0, bossKills: 0, maxDepth: 0, graveyardsCleared: 0, victory: false })).toBe(0);
    expect(starCoinsForRun({ nights: 5, bossKills: 1, maxDepth: 2, graveyardsCleared: 1, victory: false })).toBe(23);
    expect(starCoinsForRun({ nights: 10, bossKills: 3, maxDepth: 3, graveyardsCleared: 2, victory: true })).toBe(10 * 2 + 15 + 9 + 4 + 25);
  });
});

describe('MetaStore', () => {
  it('starts with defaults: rex + adventurer owned, zero coins', () => {
    const meta = MetaStore.get();
    expect(meta.coins).toBe(0);
    expect(meta.companions).toContain('rex');
    expect(meta.classes).toContain('adventurer');
    expect(meta.modifiers).toEqual([]);
  });

  it('banks and spends coins on unlocks', () => {
    MetaStore.addCoins(100);
    expect(MetaStore.get().coins).toBe(100);
    expect(MetaStore.unlock('companion', 'whiskers')).toBe(true); // 30
    expect(MetaStore.get().coins).toBe(70);
    expect(MetaStore.isUnlocked('companion', 'whiskers')).toBe(true);
    // Can't buy twice
    expect(MetaStore.unlock('companion', 'whiskers')).toBe(false);
    expect(MetaStore.get().coins).toBe(70);
    // Can't afford bolt after buying ember
    expect(MetaStore.unlock('companion', 'ember')).toBe(true); // 60 → 10 left
    expect(MetaStore.unlock('companion', 'bolt')).toBe(false); // costs 90
    expect(MetaStore.get().coins).toBe(10);
  });

  it('unlocks classes and modifiers with the right prices', () => {
    expect(priceOf('class', 'knight')).toBe(40);
    expect(priceOf('modifier', 'winter')).toBe(50);
    MetaStore.addCoins(90);
    expect(MetaStore.unlock('class', 'knight')).toBe(true);
    expect(MetaStore.unlock('modifier', 'winter')).toBe(true);
    expect(MetaStore.isUnlocked('class', 'knight')).toBe(true);
    expect(MetaStore.isUnlocked('modifier', 'winter')).toBe(true);
    expect(MetaStore.get().coins).toBe(0);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('mine2d:meta_v1', '{broken json!!');
    const meta = MetaStore.get();
    expect(meta.coins).toBe(0);
    expect(meta.companions).toContain('rex');
  });

  it('counts victories', () => {
    MetaStore.recordVictory();
    MetaStore.recordVictory();
    expect(MetaStore.get().victories).toBe(2);
  });
});
