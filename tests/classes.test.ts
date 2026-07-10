import { describe, expect, it } from 'vitest';
import { CLASS_SPECS, applyClassStart, classBowBonus, classMeleeBonus, classMineMult } from '../src/systems/Classes';
import { makeGameState } from '../src/state/GameState';
import { generateWorld } from '../src/world/generate';
import { TileType } from '../src/world/tileTypes';

describe('classes', () => {
  it('knight starts with an iron sword and hits harder', () => {
    const state = makeGameState();
    applyClassStart(state, 'knight');
    expect(state.classId).toBe('knight');
    expect(state.swordTier).toBe(1);
    expect(classMeleeBonus(state)).toBe(6);
  });

  it('ranger starts with a bow and 20 arrows', () => {
    const state = makeGameState();
    applyClassStart(state, 'ranger');
    expect(state.hasBow).toBe(true);
    expect(state.inventory.counts.arrow).toBe(20);
    expect(classBowBonus(state)).toBe(6);
  });

  it('engineer starts with the hammer and a turret kit', () => {
    const state = makeGameState();
    applyClassStart(state, 'engineer');
    expect(state.hasHammer).toBe(true);
    expect(state.inventory.counts.wood).toBe(5);
    expect(state.inventory.counts.iron).toBe(3);
  });

  it('miner starts with a stone pickaxe and mines twice as fast', () => {
    const state = makeGameState();
    applyClassStart(state, 'miner');
    expect(state.pickaxeTier).toBe(1);
    expect(classMineMult(state)).toBe(2);
  });

  it('adventurer is the plain default', () => {
    const state = makeGameState();
    applyClassStart(state, 'adventurer');
    expect(classMeleeBonus(state)).toBe(0);
    expect(classMineMult(state)).toBe(1);
    expect(CLASS_SPECS.adventurer.kit).toEqual([]);
  });
});

describe('world modifiers', () => {
  function countType(tiles: { type: TileType }[][], type: TileType): number {
    let n = 0;
    for (const row of tiles) for (const t of row) if (t.type === type) n++;
    return n;
  }

  it('winter world freezes the lake solid', () => {
    const winter = generateWorld(4242, 'winter');
    expect(countType(winter.tiles, TileType.Water)).toBe(0);
    expect(countType(winter.tiles, TileType.Ice)).toBeGreaterThan(50);
  });

  it('island world has much more water than classic', () => {
    const classic = generateWorld(4242, null);
    const island = generateWorld(4242, 'island');
    expect(countType(island.tiles, TileType.Water)).toBeGreaterThan(countType(classic.tiles, TileType.Water) * 1.5);
  });

  it('lava world has three volcanoes and extra gold', () => {
    const classic = generateWorld(777, null);
    const lava = generateWorld(777, 'lava');
    expect(countType(lava.tiles, TileType.Volcano)).toBeGreaterThanOrEqual(2); // 3 attempts, placement can rarely miss
    expect(countType(lava.tiles, TileType.GoldOre)).toBeGreaterThan(countType(classic.tiles, TileType.GoldOre));
  });
});
