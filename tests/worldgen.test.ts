import { describe, it, expect } from 'vitest';
import { generateWorld, mulberry32 } from '../src/world/generate';
import { TileType } from '../src/world/tileTypes';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../src/config';

describe('generateWorld', () => {
  it('is deterministic for a given seed', () => {
    const a = generateWorld(12345);
    const b = generateWorld(12345);
    expect(a.playerSpawn).toEqual(b.playerSpawn);
    expect(a.shopPos).toEqual(b.shopPos);
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        expect(a.tiles[y][x].type).toBe(b.tiles[y][x].type);
      }
    }
  });

  it('spawns player on grass and clears a 3x3 area', () => {
    const w = generateWorld(77);
    const { x, y } = w.playerSpawn;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(w.tiles[y + dy][x + dx].type).toBe(TileType.Grass);
      }
    }
  });

  it('places exactly one shop NPC', () => {
    const w = generateWorld(42);
    let count = 0;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (w.tiles[y][x].type === TileType.ShopNPC) count++;
      }
    }
    expect(count).toBe(1);
  });

  it('contains some ore deposits', () => {
    const w = generateWorld(99);
    let iron = 0;
    let gold = 0;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (w.tiles[y][x].type === TileType.IronOre) iron++;
        if (w.tiles[y][x].type === TileType.GoldOre) gold++;
      }
    }
    expect(iron).toBeGreaterThan(3);
    expect(gold).toBeGreaterThan(0);
  });
});

describe('mulberry32', () => {
  it('produces the same sequence for same seed', () => {
    const r1 = mulberry32(1);
    const r2 = mulberry32(1);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});
