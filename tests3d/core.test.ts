import { describe, expect, it } from 'vitest';
import { Grid } from '../src3d/grid';
import { computeFlowField, nextStep } from '../src3d/flowfield';
import { floodWalkable, generateWorld, shoreTiles } from '../src3d/worldgen';
import { B, Ground, buildOption, canAfford, emptyInventory, pay, swingsToBreak } from '../src3d/rules';
import { nightSpawns, planRun } from '../src3d/director';
import { Rng } from '../src3d/rng';

function flatGrid(size: number): Grid {
  const g = new Grid(size);
  g.ground.fill(Ground.Grass);
  return g;
}

describe('worldgen', () => {
  it('is deterministic per seed', () => {
    const a = generateWorld(44, 123).grid;
    const b = generateWorld(44, 123).grid;
    expect(Array.from(a.block)).toEqual(Array.from(b.block));
  });

  it.each([1, 7, 42, 999, 31337])('seed %i: every walkable tile reachable, resources present', (seed) => {
    const { grid, spawn } = generateWorld(44, seed);
    expect(grid.walkable(spawn.x, spawn.y)).toBe(true);
    const seen = floodWalkable(grid, spawn);
    for (let y = 0; y < grid.size; y++)
      for (let x = 0; x < grid.size; x++)
        if (grid.walkable(x, y)) expect(seen[grid.idx(x, y)]).toBe(1);
    expect(grid.count(B.Tree)).toBeGreaterThan(40);
    expect(grid.count(B.Rock)).toBeGreaterThan(15);
    expect(grid.count(B.Iron)).toBeGreaterThanOrEqual(10);
    expect(grid.count(B.Gold)).toBeGreaterThanOrEqual(6);
    expect(shoreTiles(grid).length).toBeGreaterThan(30);
  });
});

describe('flow field', () => {
  it('walks around a wall with a gap instead of through it', () => {
    const g = flatGrid(10);
    for (let y = 0; y < 9; y++) g.setBlock(5, y, B.WallStone); // gap at y=9
    const f = computeFlowField(g, 8, 2);
    let pos = { x: 1, y: 2 };
    for (let i = 0; i < 40 && !(pos.x === 8 && pos.y === 2); i++) {
      const s = nextStep(g, f, pos.x, pos.y)!;
      expect(g.blockAt(s.x, s.y)).toBe(B.None);
      pos = s;
    }
    expect(pos).toEqual({ x: 8, y: 2 });
  });

  it.each([1, 7, 42, 999])('seed %i: reaches every land tile of a real island', (seed) => {
    const { grid, spawn } = generateWorld(44, seed);
    const f = computeFlowField(grid, spawn.x, spawn.y);
    for (let y = 0; y < grid.size; y++)
      for (let x = 0; x < grid.size; x++)
        if (grid.isLand(x, y)) expect(Number.isFinite(f[grid.idx(x, y)])).toBe(true);
  });

  it('chews through a wall when fully enclosed', () => {
    const g = flatGrid(10);
    for (let y = 0; y < 10; y++) g.setBlock(5, y, B.WallWood);
    const f = computeFlowField(g, 8, 2);
    expect(Number.isFinite(f[g.idx(1, 2)])).toBe(true);
  });
});

describe('rules', () => {
  it('wall prefers stone when affordable', () => {
    const inv = emptyInventory();
    inv.wood = 4;
    expect(buildOption('wall', inv).block).toBe(B.WallWood);
    inv.stone = 2;
    expect(buildOption('wall', inv).block).toBe(B.WallStone);
  });

  it('pay only when affordable', () => {
    const inv = emptyInventory();
    inv.wood = 1;
    expect(canAfford(inv, { wood: 2 })).toBe(false);
    expect(pay(inv, { wood: 2 })).toBe(false);
    expect(inv.wood).toBe(1);
    expect(pay(inv, { wood: 1 })).toBe(true);
    expect(inv.wood).toBe(0);
  });

  it('crystal needs an iron pickaxe', () => {
    expect(swingsToBreak(B.Crystal, 1)).toBe(Infinity);
    expect(swingsToBreak(B.Crystal, 2)).toBeLessThan(5);
    expect(swingsToBreak(B.Tree, 0)).toBe(3);
  });
});

describe('director', () => {
  it('plans 7 nights with a first night, a giant, and the King finale', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = planRun(seed);
      expect(p.cards).toHaveLength(7);
      expect(p.cards[0]).toBe('first');
      expect(p.cards[6]).toBe('king');
      expect(p.cards.slice(3, 5)).toContain('giant');
      expect(new Set(p.cards).size).toBe(7);
      expect(p.days[1]).toBe('dog');
    }
  });

  it('nights grow and the King appears on night 7', () => {
    const rng = new Rng(9);
    expect(nightSpawns(1, 'first', rng).length).toBeLessThan(nightSpawns(6, 'runners', rng).length);
    expect(nightSpawns(7, 'king', rng)).toContain('king');
    expect(nightSpawns(4, 'giant', rng).filter((t) => t === 'giant')).toHaveLength(1);
  });
});
