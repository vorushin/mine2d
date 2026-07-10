import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { SaveLoad } from '../src/systems/SaveLoad';
import { makeGameState, addItem } from '../src/state/GameState';
import { TileType, TILE_SPECS } from '../src/world/tileTypes';
import { Tile, generateWorld } from '../src/world/generate';
import { generateCave } from '../src/world/generateCave';
import { RECIPES, applyCraft, canCraft } from '../src/systems/Crafting';
import { specForCave, specForSpiderling } from '../src/entities/Zombie';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config';

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

function surfaceTiles(): Tile[][] {
  const tiles: Tile[][] = [];
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) row.push({ type: TileType.Grass, hp: 0 });
    tiles.push(row);
  }
  return tiles;
}

describe('Deep Dark crafting', () => {
  it('crystal pickaxe upgrades to tier 3 and consumes inputs', () => {
    const state = makeGameState();
    state.pickaxeTier = 2;
    addItem(state.inventory, 'crystal', 3);
    addItem(state.inventory, 'iron', 2);
    const recipe = RECIPES.find((r) => r.id === 'crystal_pickaxe')!;
    expect(applyCraft(recipe, state)).toEqual({ ok: true });
    expect(state.pickaxeTier).toBe(3);
    expect(state.inventory.counts.crystal).toBeUndefined();
    expect(canCraft(recipe, state)).toEqual({ ok: false, reason: 'missing_materials' });
  });

  it('crystal sword reaches tier 2 and cannot be re-crafted', () => {
    const state = makeGameState();
    state.swordTier = 1;
    addItem(state.inventory, 'crystal', 2);
    addItem(state.inventory, 'iron', 1);
    const recipe = RECIPES.find((r) => r.id === 'crystal_sword')!;
    expect(applyCraft(recipe, state)).toEqual({ ok: true });
    expect(state.swordTier).toBe(2);
    addItem(state.inventory, 'crystal', 2);
    addItem(state.inventory, 'iron', 1);
    expect(canCraft(recipe, state)).toEqual({ ok: false, reason: 'already_have' });
  });

  it('crystal/obsidian ore gates match pickaxe tiers', () => {
    expect(TILE_SPECS[TileType.CrystalOre].pickaxeTier).toBe(2);
    expect(TILE_SPECS[TileType.ObsidianOre].pickaxeTier).toBe(3);
    expect(TILE_SPECS[TileType.WallObsidian].baseHp).toBeGreaterThan(TILE_SPECS[TileType.WallReinforced].baseHp);
  });
});

describe('cave monsters', () => {
  it('floor 1 spawns only bats and spiders', () => {
    for (let i = 0; i < 30; i++) {
      const spec = specForCave(1, 3, () => i / 30);
      expect(['bat', 'spider']).toContain(spec.variant);
    }
  });

  it('skeletons appear from floor 2', () => {
    expect(specForCave(2, 3, () => 0.1).variant).toBe('skeleton');
    expect(specForCave(3, 3, () => 0.4).variant).toBe('skeleton');
  });

  it('deeper floors and later nights scale monster stats', () => {
    const shallow = specForCave(1, 1, () => 0.99);
    const deep = specForCave(3, 10, () => 0.99);
    expect(deep.hp).toBeGreaterThan(shallow.hp);
    expect(deep.damage).toBeGreaterThan(shallow.damage);
  });

  it('behavior flags are set per variant', () => {
    expect(specForCave(1, 1, () => 0.3).erratic).toBe(true); // bat (roll < 0.45)
    expect(specForCave(1, 1, () => 0.99).layWebs).toBe(true); // spider
    expect(specForCave(2, 1, () => 0.05).rangedRangePx).toBeGreaterThan(0); // skeleton
    expect(specForSpiderling(4).variant).toBe('spiderling');
  });
});

describe('save/load with the Deep Dark', () => {
  it('round-trips visited caves, depth, and run seed', () => {
    const state = makeGameState();
    state.depth = 2;
    addItem(state.inventory, 'crystal', 4);
    const cave1 = generateCave(777, 1);
    const cave2 = generateCave(777, 2);
    // Simulate some mining in cave 2
    const dug = cave2.tiles.flatMap((row, y) => row.map((t, x) => ({ t, x, y })))
      .find((c) => c.t.type === TileType.CaveRock)!;
    dug.t.type = TileType.CaveFloor;
    dug.t.hp = 0;

    const ok = SaveLoad.save({
      state,
      tiles: surfaceTiles(),
      playerSpawn: { x: 50, y: 50 },
      shopPos: { x: 52, y: 50 },
      playerWorldPos: { x: 900, y: 900 },
      dog: null,
      caves: [cave1, cave2, null],
      depth: 2,
      runSeed: 777,
    });
    expect(ok).toBe(true);

    const loaded = SaveLoad.load()!;
    expect(loaded.depth).toBe(2);
    expect(loaded.runSeed).toBe(777);
    expect(loaded.caves[0]).not.toBeNull();
    expect(loaded.caves[1]).not.toBeNull();
    expect(loaded.caves[2]).toBeNull();
    expect(loaded.caves[0]!.entry).toEqual(cave1.entry);
    expect(loaded.caves[0]!.ladderDown).toEqual(cave1.ladderDown);
    expect(loaded.caves[1]!.tiles[dug.y][dug.x].type).toBe(TileType.CaveFloor);
    expect(loaded.state.inventory.counts.crystal).toBe(4);
  });

  it('old saves without caves load at the surface', () => {
    localStorage.setItem('mine2d:save_v1', JSON.stringify({
      version: 1,
      world: { width: 4, height: 4, tiles: [], playerSpawn: {}, shopPos: {} },
      player: { inventory: {} },
    }));
    const loaded = SaveLoad.load()!;
    expect(loaded.depth).toBe(0);
    expect(loaded.caves).toEqual([null, null, null]);
  });

  it('a save claiming depth 2 with no cave data falls back to the surface', () => {
    const state = makeGameState();
    SaveLoad.save({
      state, tiles: surfaceTiles(),
      playerSpawn: { x: 0, y: 0 }, shopPos: { x: 0, y: 0 },
      playerWorldPos: { x: 0, y: 0 }, dog: null,
      caves: [null, null, null], depth: 0, runSeed: 5,
    });
    const raw = JSON.parse(localStorage.getItem('mine2d:save_v1')!);
    raw.depth = 2;
    localStorage.setItem('mine2d:save_v1', JSON.stringify(raw));
    expect(SaveLoad.load()!.depth).toBe(0);
  });
});

describe('surface worldgen with cave entrances', () => {
  it('seeds at least one cave entrance, with one near spawn', () => {
    for (const seed of [1, 99, 20260710]) {
      const world = generateWorld(seed);
      let near = false;
      let count = 0;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
          if (world.tiles[y][x].type !== TileType.CaveEntrance) continue;
          count++;
          if (Math.hypot(x - world.playerSpawn.x, y - world.playerSpawn.y) <= 24) near = true;
        }
      }
      expect(count).toBeGreaterThanOrEqual(1);
      expect(near).toBe(true);
    }
  });
});
