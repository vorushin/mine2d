import { describe, expect, it } from 'vitest';
import { findCrypts, graveyardNightBonus } from '../src/systems/Graveyards';
import { generateWorld } from '../src/world/generate';
import { TileType } from '../src/world/tileTypes';
import { Tile } from '../src/world/generate';

describe('graveyard night bonus', () => {
  it('adds 25% of the base target per intact crypt', () => {
    expect(graveyardNightBonus(0, 20)).toBe(0);
    expect(graveyardNightBonus(1, 20)).toBe(5);
    expect(graveyardNightBonus(2, 20)).toBe(10);
    expect(graveyardNightBonus(3, 20)).toBe(15);
  });

  it('rounds up for small targets', () => {
    expect(graveyardNightBonus(1, 2)).toBe(1);
  });
});

describe('findCrypts', () => {
  it('locates crypt tiles', () => {
    const tiles: Tile[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({ type: TileType.Grass, hp: 0 })));
    tiles[2][3] = { type: TileType.Crypt, hp: 260 };
    tiles[4][1] = { type: TileType.Crypt, hp: 100 };
    expect(findCrypts(tiles)).toEqual([{ x: 3, y: 2 }, { x: 1, y: 4 }]);
  });
});

describe('worldgen graveyards', () => {
  it('seeds 2-3 graveyards, all far from spawn, ringed by gravestones', () => {
    for (const seed of [11, 222, 3333]) {
      const world = generateWorld(seed);
      const crypts = findCrypts(world.tiles);
      expect(crypts.length).toBeGreaterThanOrEqual(2);
      expect(crypts.length).toBeLessThanOrEqual(3);
      for (const c of crypts) {
        expect(Math.hypot(c.x - world.playerSpawn.x, c.y - world.playerSpawn.y)).toBeGreaterThanOrEqual(25);
        // At least a few gravestones around each crypt
        let stones = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (world.tiles[c.y + dy]?.[c.x + dx]?.type === TileType.Gravestone) stones++;
          }
        }
        expect(stones).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
