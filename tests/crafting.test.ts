import { describe, it, expect } from 'vitest';
import { RECIPES, applyCraft, canCraft } from '../src/systems/Crafting';
import { makeGameState, addItem, hasItem } from '../src/state/GameState';

function recipeById(id: string) {
  const r = RECIPES.find((r) => r.id === id);
  if (!r) throw new Error(`recipe not found: ${id}`);
  return r;
}

describe('Crafting', () => {
  it('does not require a bench (simplified crafting)', () => {
    const s = makeGameState();
    addItem(s.inventory, 'wood', 99);
    addItem(s.inventory, 'stone', 99);
    const r = recipeById('stone_pickaxe');
    expect(canCraft(r, s, false).ok).toBe(true);
    expect(canCraft(r, s, true).ok).toBe(true);
  });

  it('consumes materials on craft', () => {
    const s = makeGameState();
    addItem(s.inventory, 'wood', 10);
    addItem(s.inventory, 'stone', 10);
    const r = recipeById('stone_pickaxe');
    expect(applyCraft(r, s, true).ok).toBe(true);
    expect(hasItem(s.inventory, 'wood', 8)).toBe(true);
    expect(hasItem(s.inventory, 'wood', 9)).toBe(false);
    expect(hasItem(s.inventory, 'stone', 7)).toBe(true);
    expect(s.pickaxeTier).toBe(1);
  });

  it('rejects when missing materials', () => {
    const s = makeGameState();
    const r = recipeById('stone_pickaxe');
    const res = canCraft(r, s, true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('missing_materials');
  });

  it('prevents duplicate upgrade', () => {
    const s = makeGameState();
    s.pickaxeTier = 1;
    addItem(s.inventory, 'wood', 10);
    addItem(s.inventory, 'stone', 10);
    const r = recipeById('stone_pickaxe');
    const res = canCraft(r, s, true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('already_have');
  });
});
