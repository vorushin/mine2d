import { describe, expect, it } from 'vitest';
import { RECIPES, applyCraft, canCraft } from '../src/systems/Crafting';
import { makeGameState, addItem } from '../src/state/GameState';
import { HOTBAR, PRIMARY_HOTBAR_SLOTS, hotbarAvailable } from '../src/ui/hotbarDef';
import { CHICKEN_ARMY_MAX } from '../src/entities/Chicken';

describe('wands and rod', () => {
  it('freeze wand crafts from crystal + gold and unlocks once', () => {
    const state = makeGameState();
    addItem(state.inventory, 'crystal', 3);
    addItem(state.inventory, 'gold', 1);
    const recipe = RECIPES.find((r) => r.id === 'freeze_wand')!;
    expect(applyCraft(recipe, state)).toEqual({ ok: true });
    expect(state.hasFreezeWand).toBe(true);
    addItem(state.inventory, 'crystal', 3);
    addItem(state.inventory, 'gold', 1);
    expect(canCraft(recipe, state)).toEqual({ ok: false, reason: 'already_have' });
  });

  it('storm wand and fishing rod unlock their flags', () => {
    const state = makeGameState();
    addItem(state.inventory, 'crystal', 3);
    addItem(state.inventory, 'iron', 2);
    expect(applyCraft(RECIPES.find((r) => r.id === 'storm_wand')!, state)).toEqual({ ok: true });
    expect(state.hasStormWand).toBe(true);
    addItem(state.inventory, 'wood', 3);
    addItem(state.inventory, 'iron', 1);
    expect(applyCraft(RECIPES.find((r) => r.id === 'fishing_rod')!, state)).toEqual({ ok: true });
    expect(state.hasRod).toBe(true);
  });

  it('wand and rod hotbar slots gate on their unlock flags', () => {
    const state = makeGameState();
    const freezeIdx = HOTBAR.findIndex((a) => a.kind === 'wand' && a.wand === 'freeze');
    const stormIdx = HOTBAR.findIndex((a) => a.kind === 'wand' && a.wand === 'storm');
    const rodIdx = HOTBAR.findIndex((a) => a.kind === 'fish');
    expect(freezeIdx).toBeGreaterThanOrEqual(0);
    expect(hotbarAvailable(freezeIdx, state)).toBe(false);
    expect(hotbarAvailable(rodIdx, state)).toBe(false);
    state.hasFreezeWand = true;
    state.hasStormWand = true;
    state.hasRod = true;
    expect(hotbarAvailable(freezeIdx, state)).toBe(true);
    expect(hotbarAvailable(stormIdx, state)).toBe(true);
    expect(hotbarAvailable(rodIdx, state)).toBe(true);
  });

  it('primary hotbar now exposes 9 tools (keys 1-9)', () => {
    expect(PRIMARY_HOTBAR_SLOTS).toHaveLength(9);
  });
});

describe('chicken army', () => {
  it('caps the army at three brave birds', () => {
    expect(CHICKEN_ARMY_MAX).toBe(3);
  });
});
