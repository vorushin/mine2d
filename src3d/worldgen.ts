import { Grid } from './grid';
import { Rng } from './rng';
import { B, Ground } from './rules';

/** Smooth 2D value noise in [0,1]. */
export function makeNoise(rng: Rng, cell: number) {
  const n = 64;
  const vals = new Float32Array(n * n);
  for (let i = 0; i < vals.length; i++) vals[i] = rng.next();
  const at = (x: number, y: number) => vals[((y % n) + n) % n * n + (((x % n) + n) % n)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number): number => {
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smooth(fx - x0), ty = smooth(fy - y0);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

export interface GeneratedWorld {
  grid: Grid;
  spawn: { x: number; y: number };
}

export function generateWorld(size: number, seed: number): GeneratedWorld {
  const rng = new Rng(seed);
  const grid = new Grid(size);
  const shape = makeNoise(rng, 7);
  const forest = makeNoise(rng, 6);
  const rocky = makeNoise(rng, 8);
  const c = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c, dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const h = 1 - d * 1.05 + (shape(x, y) - 0.5) * 0.45;
      const i = grid.idx(x, y);
      if (h < 0.12 || x < 2 || y < 2 || x > size - 3 || y > size - 3) grid.ground[i] = Ground.Water;
      else if (h < 0.22) grid.ground[i] = Ground.Sand;
      else grid.ground[i] = Ground.Grass;
    }
  }

  const spawn = { x: Math.round(c), y: Math.round(c) };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = grid.idx(x, y);
      if (grid.ground[i] !== Ground.Grass) continue;
      if (Math.hypot(x - spawn.x, y - spawn.y) < 3.5) continue;
      const f = forest(x, y);
      const r = rocky(x + 100, y + 100);
      if (r > 0.66 && rng.chance(0.62)) {
        const ore = rng.next();
        const deep = r > 0.71;
        grid.setBlock(x, y, deep && ore < 0.22 ? B.Iron : deep && ore < 0.3 ? B.Gold : B.Rock);
      } else if (f > 0.58 && rng.chance(0.55)) {
        grid.setBlock(x, y, B.Tree);
      } else if (rng.chance(0.025)) {
        grid.setBlock(x, y, rng.chance(0.6) ? B.Tree : B.Rock);
      }
    }
  }

  // A small ring of starter trees + rocks near spawn, so the first minute is quick.
  const near: [number, B][] = [[0, B.Tree], [1, B.Tree], [2, B.Rock], [3, B.Tree], [4, B.Rock], [5, B.Tree]];
  for (const [k, b] of near) {
    const a = (k / near.length) * Math.PI * 2 + 0.4;
    const x = Math.round(spawn.x + Math.cos(a) * 4.5), y = Math.round(spawn.y + Math.sin(a) * 4.5);
    if (grid.groundAt(x, y) === Ground.Grass) grid.setBlock(x, y, b);
  }

  connect(grid, spawn);

  // Guarantee a little iron and gold somewhere on the island. Only existing
  // solid blocks get swapped, so connectivity is preserved.
  ensureAtLeast(grid, rng, B.Iron, 10);
  ensureAtLeast(grid, rng, B.Gold, 6);
  ensureAtLeast(grid, rng, B.Crystal, 2, 12);
  return { grid, spawn };
}

function ensureAtLeast(grid: Grid, rng: Rng, b: B, n: number, minDist = 6): void {
  let have = grid.count(b);
  const c = grid.size / 2;
  for (let tries = 0; have < n && tries < 20000; tries++) {
    const x = rng.int(3, grid.size - 4), y = rng.int(3, grid.size - 4);
    if (grid.groundAt(x, y) !== Ground.Grass) continue;
    if (Math.hypot(x - c, y - c) < minDist) continue;
    const cur = grid.blockAt(x, y);
    if (cur === B.Rock || (tries > 8000 && cur === B.Tree)) {
      grid.setBlock(x, y, b);
      have++;
    }
  }
}

/** Make every walkable land tile reachable from spawn by carving through natural blocks. */
function connect(grid: Grid, spawn: { x: number; y: number }): void {
  const seen = floodWalkable(grid, spawn);
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.walkable(x, y) || seen[grid.idx(x, y)]) continue;
      // Walk toward spawn, clearing blocks until we hit reached ground.
      let cx = x, cy = y;
      while (!seen[grid.idx(cx, cy)]) {
        if (Math.abs(spawn.x - cx) > Math.abs(spawn.y - cy)) cx += Math.sign(spawn.x - cx);
        else cy += Math.sign(spawn.y - cy);
        if (grid.blockAt(cx, cy) !== B.None) grid.setBlock(cx, cy, B.None);
        if (!grid.isLand(cx, cy)) grid.ground[grid.idx(cx, cy)] = Ground.Sand;
        if (cx === spawn.x && cy === spawn.y) break;
      }
      const again = floodWalkable(grid, spawn);
      seen.set(again);
    }
  }
}

export function floodWalkable(grid: Grid, from: { x: number; y: number }): Uint8Array {
  const seen = new Uint8Array(grid.size * grid.size);
  const q: number[] = [grid.idx(from.x, from.y)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % grid.size, y = (i / grid.size) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!grid.walkable(nx, ny)) continue;
      const j = grid.idx(nx, ny);
      if (seen[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** Beach tiles (land touching water) — where the horde crawls out of the sea. */
export function shoreTiles(grid: Grid): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < grid.size - 1; y++) {
    for (let x = 1; x < grid.size - 1; x++) {
      if (!grid.walkable(x, y)) continue;
      if (!grid.isLand(x + 1, y) || !grid.isLand(x - 1, y) || !grid.isLand(x, y + 1) || !grid.isLand(x, y - 1)) {
        out.push({ x, y });
      }
    }
  }
  return out;
}
