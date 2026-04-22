import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SaveLoad } from '../src/systems/SaveLoad';
import { makeGameState, addItem } from '../src/state/GameState';
import { TileType, TILE_SPECS } from '../src/world/tileTypes';
import { Tile } from '../src/world/generate';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config';

beforeAll(() => {
  // happy-dom's localStorage can be missing in some versions; provide a shim.
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

function makeTiles(): Tile[][] {
  const tiles: Tile[][] = [];
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      row.push({ type: TileType.Grass, hp: TILE_SPECS[TileType.Grass].baseHp });
    }
    tiles.push(row);
  }
  return tiles;
}

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

describe('SaveLoad', () => {
  it('round-trips a basic snapshot', () => {
    const state = makeGameState();
    state.nightNumber = 4;
    state.score = 3;
    state.pickaxeTier = 2;
    state.playerMaxHp = 145;
    state.playerHp = 80;
    state.hasBow = true;
    addItem(state.inventory, 'wood', 17);
    addItem(state.inventory, 'gold', 9);
    state.stats = { zombiesKilled: 42, tilesMined: 10, tilesPlaced: 8, goldEarned: 12 };

    const tiles = makeTiles();
    tiles[5][5].type = TileType.Volcano;
    tiles[5][5].hp = 250;
    tiles[10][10].type = TileType.Bridge;
    tiles[10][10].hp = 6;

    const ok = SaveLoad.save({
      state,
      tiles,
      playerSpawn: { x: 30, y: 30 },
      shopPos: { x: 35, y: 32 },
      playerWorldPos: { x: 960, y: 980 },
      dog: { alive: true, hp: 50, level: 3, kills: 9, x: 970, y: 985 },
    });
    expect(ok).toBe(true);
    expect(SaveLoad.hasSave()).toBe(true);

    const loaded = SaveLoad.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.nightNumber).toBe(4);
    expect(loaded!.state.score).toBe(3);
    expect(loaded!.state.pickaxeTier).toBe(2);
    expect(loaded!.state.playerMaxHp).toBe(145);
    expect(loaded!.state.playerHp).toBe(80);
    expect(loaded!.state.hasBow).toBe(true);
    expect(loaded!.state.inventory.counts.wood).toBe(17);
    expect(loaded!.state.inventory.counts.gold).toBe(9);
    expect(loaded!.state.stats.zombiesKilled).toBe(42);
    expect(loaded!.tiles[5][5].type).toBe(TileType.Volcano);
    expect(loaded!.tiles[5][5].hp).toBe(250);
    expect(loaded!.tiles[10][10].type).toBe(TileType.Bridge);
    expect(loaded!.playerSpawn).toEqual({ x: 30, y: 30 });
    expect(loaded!.shopPos).toEqual({ x: 35, y: 32 });
    expect(loaded!.playerWorldPos).toEqual({ x: 960, y: 980 });
    expect(loaded!.dog?.level).toBe(3);
    expect(loaded!.dog?.kills).toBe(9);
  });

  it('clear() removes the save', () => {
    const state = makeGameState();
    SaveLoad.save({
      state, tiles: makeTiles(),
      playerSpawn: { x: 0, y: 0 }, shopPos: { x: 0, y: 0 },
      playerWorldPos: { x: 0, y: 0 }, dog: null,
    });
    expect(SaveLoad.hasSave()).toBe(true);
    SaveLoad.clear();
    expect(SaveLoad.hasSave()).toBe(false);
    expect(SaveLoad.load()).toBeNull();
  });

  it('handles missing fields with defaults (forward compat)', () => {
    // Simulate an old/partial save
    localStorage.setItem('mine2d:save_v1', JSON.stringify({
      version: 1,
      world: { width: 60, height: 60, tiles: [], playerSpawn: {}, shopPos: {} },
      player: { inventory: { wood: 5 } },
      // No cycle, no stats, no dog
    }));
    const loaded = SaveLoad.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.playerMaxHp).toBe(100); // default
    expect(loaded!.state.nightNumber).toBe(1);
    expect(loaded!.state.phase).toBe('day');
    expect(loaded!.state.inventory.counts.wood).toBe(5);
    expect(loaded!.state.stats.zombiesKilled).toBe(0);
    expect(loaded!.dog).toBeNull();
    // Tile grid is all grass (defaults)
    expect(loaded!.tiles[0][0].type).toBe(TileType.Grass);
    expect(loaded!.tiles.length).toBe(WORLD_HEIGHT);
    expect(loaded!.tiles[0].length).toBe(WORLD_WIDTH);
  });

  it('gracefully ignores unknown tile names (future compat)', () => {
    // A save from a future version with a tile type we don't know about
    const tiles = Array.from({ length: WORLD_WIDTH * WORLD_HEIGHT }, (_, i) => ({
      t: i === 123 ? 'some_future_tile_type_99' : 'grass', h: 0,
    }));
    localStorage.setItem('mine2d:save_v1', JSON.stringify({
      version: 1,
      world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, tiles, playerSpawn: { x: 10, y: 10 }, shopPos: { x: 15, y: 10 } },
    }));
    const loaded = SaveLoad.load();
    expect(loaded).not.toBeNull();
    // Unknown tile type fell back to grass
    const col = 123 % WORLD_WIDTH;
    const row = Math.floor(123 / WORLD_WIDTH);
    expect(loaded!.tiles[row][col].type).toBe(TileType.Grass);
  });

  it('rejects malformed JSON', () => {
    localStorage.setItem('mine2d:save_v1', '{not valid json');
    expect(SaveLoad.load()).toBeNull();
  });

  it('rejects unknown version', () => {
    localStorage.setItem('mine2d:save_v1', JSON.stringify({ version: 0 }));
    expect(SaveLoad.load()).toBeNull();
  });

  it('clamps nonsense values into valid ranges', () => {
    localStorage.setItem('mine2d:save_v1', JSON.stringify({
      version: 1,
      player: { hp: 999999, maxHp: -5, pickaxeTier: 99, swordTier: -1, hotbarSlot: -10 },
      cycle: { phase: 'banana', phaseElapsedMs: -100, nightNumber: -3, score: -1 },
      world: { width: 60, height: 60, tiles: [], playerSpawn: {}, shopPos: {} },
    }));
    const loaded = SaveLoad.load()!;
    expect(loaded.state.playerMaxHp).toBeGreaterThanOrEqual(50);
    expect(loaded.state.playerHp).toBeLessThanOrEqual(loaded.state.playerMaxHp);
    expect(loaded.state.pickaxeTier).toBeLessThanOrEqual(2);
    expect(loaded.state.swordTier).toBeGreaterThanOrEqual(0);
    expect(loaded.state.hotbarSlot).toBeGreaterThanOrEqual(0);
    expect(['day', 'dusk', 'night', 'dawn']).toContain(loaded.state.phase);
    expect(loaded.state.phaseElapsedMs).toBe(0);
    expect(loaded.state.nightNumber).toBe(1);
    expect(loaded.state.score).toBe(0);
  });

  it('ignores unknown inventory materials', () => {
    localStorage.setItem('mine2d:save_v1', JSON.stringify({
      version: 1,
      player: { inventory: { wood: 3, unobtainium: 99, food: 2 } },
      world: { width: 60, height: 60, tiles: [], playerSpawn: {}, shopPos: {} },
    }));
    const loaded = SaveLoad.load()!;
    expect(loaded.state.inventory.counts.wood).toBe(3);
    expect(loaded.state.inventory.counts.food).toBe(2);
    expect((loaded.state.inventory.counts as Record<string, number>).unobtainium).toBeUndefined();
  });
});
