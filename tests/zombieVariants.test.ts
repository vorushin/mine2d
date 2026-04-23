import { describe, it, expect } from 'vitest';
import { bruteChanceForNight } from '../src/entities/Zombie';
import { BRUTE_CHANCE_BY_NIGHT } from '../src/config';
import { RECIPES, applyCraft } from '../src/systems/Crafting';
import { makeGameState, addItem, hasItem } from '../src/state/GameState';

describe('bruteChanceForNight', () => {
  it('starts at 0 for early nights', () => {
    expect(bruteChanceForNight(1)).toBe(0);
    expect(bruteChanceForNight(4)).toBe(0);
  });

  it('rises on night 5+ per the config table', () => {
    for (let n = 5; n <= BRUTE_CHANCE_BY_NIGHT.length; n++) {
      expect(bruteChanceForNight(n)).toBe(BRUTE_CHANCE_BY_NIGHT[n - 1]);
    }
  });

  it('uses the last table entry for nights beyond the table', () => {
    const last = BRUTE_CHANCE_BY_NIGHT[BRUTE_CHANCE_BY_NIGHT.length - 1];
    expect(bruteChanceForNight(100)).toBe(last);
  });
});

describe('engineering recipes', () => {
  it('crafts 4 reinforced-wall tokens for 2 iron + 3 stone', () => {
    const s = makeGameState();
    addItem(s.inventory, 'iron', 5);
    addItem(s.inventory, 'stone', 5);
    const r = RECIPES.find((r) => r.id === 'reinforced_wall_x4')!;
    expect(applyCraft(r, s, true).ok).toBe(true);
    expect(hasItem(s.inventory, 'wallReinforced', 4)).toBe(true);
    expect(hasItem(s.inventory, 'iron', 3)).toBe(true);
    expect(hasItem(s.inventory, 'stone', 2)).toBe(true);
  });

  it('unlocks the repair hammer once', () => {
    const s = makeGameState();
    addItem(s.inventory, 'wood', 5);
    addItem(s.inventory, 'iron', 2);
    const r = RECIPES.find((r) => r.id === 'repair_hammer')!;
    expect(applyCraft(r, s, true).ok).toBe(true);
    expect(s.hasHammer).toBe(true);
    // Second attempt fails as 'already_have'
    const res2 = applyCraft(r, s, true);
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.reason).toBe('already_have');
  });

  it('crafts 3 bombs', () => {
    const s = makeGameState();
    addItem(s.inventory, 'wood', 10);
    addItem(s.inventory, 'iron', 10);
    const r = RECIPES.find((r) => r.id === 'bomb_x3')!;
    expect(applyCraft(r, s, true).ok).toBe(true);
    expect(hasItem(s.inventory, 'bomb', 3)).toBe(true);
  });

  it('crafts a flame turret token', () => {
    const s = makeGameState();
    addItem(s.inventory, 'wood', 10);
    addItem(s.inventory, 'stone', 10);
    addItem(s.inventory, 'iron', 10);
    const r = RECIPES.find((r) => r.id === 'flame_turret')!;
    expect(applyCraft(r, s, true).ok).toBe(true);
    expect(hasItem(s.inventory, 'turretFlame', 1)).toBe(true);
  });
});
