import { describe, it, expect } from 'vitest';
import { makeInventory, addItem, hasItem, removeItem } from '../src/state/GameState';

describe('Inventory', () => {
  it('starts empty', () => {
    const inv = makeInventory();
    expect(hasItem(inv, 'wood', 1)).toBe(false);
  });

  it('adds, checks, removes', () => {
    const inv = makeInventory();
    addItem(inv, 'wood', 5);
    expect(hasItem(inv, 'wood', 5)).toBe(true);
    expect(hasItem(inv, 'wood', 6)).toBe(false);
    expect(removeItem(inv, 'wood', 3)).toBe(true);
    expect(hasItem(inv, 'wood', 2)).toBe(true);
    expect(hasItem(inv, 'wood', 3)).toBe(false);
  });

  it('refuses to go negative', () => {
    const inv = makeInventory();
    addItem(inv, 'iron', 2);
    expect(removeItem(inv, 'iron', 5)).toBe(false);
    expect(hasItem(inv, 'iron', 2)).toBe(true);
  });

  it('cleans up zero entries', () => {
    const inv = makeInventory();
    addItem(inv, 'gold', 1);
    removeItem(inv, 'gold', 1);
    expect(inv.counts.gold).toBeUndefined();
  });
});
