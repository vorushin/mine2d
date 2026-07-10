import { describe, expect, it } from 'vitest';
import { CAVE_H, CAVE_W, GeneratedCave, generateCave } from '../src/world/generateCave';
import { TileType, TILE_SPECS } from '../src/world/tileTypes';

function countType(cave: GeneratedCave, type: TileType): number {
  let n = 0;
  for (const row of cave.tiles) for (const t of row) if (t.type === type) n++;
  return n;
}

/** BFS over player-walkable tiles from the entry. */
function reachable(cave: GeneratedCave): Set<number> {
  const seen = new Set<number>();
  const queue = [cave.entry.y * CAVE_W + cave.entry.x];
  seen.add(queue[0]);
  while (queue.length) {
    const cur = queue.shift()!;
    const x = cur % CAVE_W;
    const y = Math.floor(cur / CAVE_W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= CAVE_W || ny >= CAVE_H) continue;
      const key = ny * CAVE_W + nx;
      if (seen.has(key)) continue;
      if (!TILE_SPECS[cave.tiles[ny][nx].type].walkable) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return seen;
}

describe('generateCave', () => {
  it('is deterministic per seed and floor', () => {
    expect(generateCave(1234, 2)).toEqual(generateCave(1234, 2));
    expect(JSON.stringify(generateCave(1234, 1))).not.toEqual(JSON.stringify(generateCave(4321, 1)));
  });

  it('keeps a solid rock border', () => {
    const cave = generateCave(99, 1);
    for (let x = 0; x < CAVE_W; x++) {
      expect(cave.tiles[0][x].type).toBe(TileType.CaveRock);
      expect(cave.tiles[CAVE_H - 1][x].type).toBe(TileType.CaveRock);
    }
    for (let y = 0; y < CAVE_H; y++) {
      expect(cave.tiles[y][0].type).toBe(TileType.CaveRock);
      expect(cave.tiles[y][CAVE_W - 1].type).toBe(TileType.CaveRock);
    }
  });

  it('places the entry ladder and a reachable ladder down on floors 1-2', () => {
    for (const floor of [1, 2] as const) {
      for (const seed of [7, 42, 20260710]) {
        const cave = generateCave(seed, floor);
        expect(cave.tiles[cave.entry.y][cave.entry.x].type).toBe(TileType.LadderUp);
        expect(cave.ladderDown).not.toBeNull();
        expect(cave.throneGate).toBeNull();
        const seen = reachable(cave);
        expect(seen.has(cave.ladderDown!.y * CAVE_W + cave.ladderDown!.x)).toBe(true);
      }
    }
  });

  it('floor 3 has a sealed throne room instead of a ladder down', () => {
    for (const seed of [7, 42, 20260710]) {
      const cave = generateCave(seed, 3);
      expect(cave.ladderDown).toBeNull();
      expect(cave.throneGate).not.toBeNull();
      expect(cave.throneCenter).not.toBeNull();
      expect(cave.tiles[cave.throneGate!.y][cave.throneGate!.x].type).toBe(TileType.ThroneGate);
      // The gate is reachable from the entry (stand next to it)…
      const seen = reachable(cave);
      const g = cave.throneGate!;
      const adjacentReachable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
        seen.has((g.y + dy) * CAVE_W + (g.x + dx)));
      expect(adjacentReachable).toBe(true);
      // …but the throne interior is NOT reachable while the gate is sealed
      const c = cave.throneCenter!;
      expect(seen.has(c.y * CAVE_W + c.x)).toBe(false);
    }
  });

  it('seeds ores appropriate to each floor', () => {
    const f1 = generateCave(555, 1);
    const f2 = generateCave(555, 2);
    const f3 = generateCave(555, 3);
    expect(countType(f1, TileType.CrystalOre)).toBe(0);
    expect(countType(f2, TileType.CrystalOre)).toBeGreaterThanOrEqual(8);
    expect(countType(f3, TileType.ObsidianOre)).toBeGreaterThanOrEqual(6);
    expect(countType(f1, TileType.ObsidianOre)).toBe(0);
    expect(countType(f1, TileType.IronOre)).toBeGreaterThanOrEqual(5);
  });

  it('places at least two treasure vaults with chests', () => {
    for (const seed of [7, 42, 20260710]) {
      expect(countType(generateCave(seed, 1), TileType.VaultChest)).toBeGreaterThanOrEqual(2);
    }
  });

  it('has lava pools only on floors 2+', () => {
    expect(countType(generateCave(31337, 1), TileType.Lava)).toBe(0);
    expect(countType(generateCave(31337, 2), TileType.Lava)).toBeGreaterThan(0);
  });
});
