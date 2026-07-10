import { TileType, TILE_SPECS } from './tileTypes';
import { Tile, mulberry32 } from './generate';

/**
 * Procedural cave floors for the Deep Dark. Deterministic per (seed, floor).
 *
 * Layout: solid CaveRock, carved by drunkard-walkers into corridors and
 * chambers. The entry ladder sits near the center; the ladder down (floors
 * 1-2) is placed at the carved tile farthest from the entry. Floor 3 gets the
 * Zombie King's sealed throne arena instead of a ladder down. Torch-lit
 * treasure vaults are walled off with rock so you mine your way in.
 */

export const CAVE_W = 60;
export const CAVE_H = 60;

export interface GeneratedCave {
  tiles: Tile[][];
  entry: { x: number; y: number };
  ladderDown: { x: number; y: number } | null;
  /** Center of the throne-gate row (floor 3 only). */
  throneGate: { x: number; y: number } | null;
  /** Arena interior center — where the King spawns (floor 3 only). */
  throneCenter: { x: number; y: number } | null;
}

function makeTile(type: TileType): Tile {
  return { type, hp: TILE_SPECS[type].baseHp };
}

export function generateCave(seed: number, floor: 1 | 2 | 3): GeneratedCave {
  const rand = mulberry32((seed ^ (floor * 0x9e3779b9)) >>> 0);
  const w = CAVE_W;
  const h = CAVE_H;

  // Solid rock everywhere
  const tiles: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < w; x++) row.push(makeTile(TileType.CaveRock));
    tiles.push(row);
  }

  const isInterior = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2;
  const carve = (x: number, y: number) => {
    if (isInterior(x, y)) tiles[y][x] = makeTile(TileType.CaveFloor);
  };

  // Drunkard-walk carving from the center — several walkers, ~34% floor
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const targetFloor = Math.floor(w * h * 0.34);
  let carved = 0;
  const walkers = 5;
  for (let i = 0; i < walkers; i++) {
    let x = cx + Math.floor((rand() - 0.5) * 8);
    let y = cy + Math.floor((rand() - 0.5) * 8);
    const steps = Math.floor(targetFloor / walkers) * 2;
    for (let s = 0; s < steps && carved < targetFloor; s++) {
      if (isInterior(x, y) && tiles[y][x].type === TileType.CaveRock) {
        carve(x, y);
        carved++;
      }
      const r = rand();
      if (r < 0.25) x++;
      else if (r < 0.5) x--;
      else if (r < 0.75) y++;
      else y--;
      x = Math.max(2, Math.min(w - 3, x));
      y = Math.max(2, Math.min(h - 3, y));
    }
  }

  // Stamp a few elliptical chambers along the carved area
  for (let i = 0; i < 4; i++) {
    const chX = 8 + Math.floor(rand() * (w - 16));
    const chY = 8 + Math.floor(rand() * (h - 16));
    const rx = 3 + Math.floor(rand() * 3);
    const ry = 2 + Math.floor(rand() * 3);
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) carve(chX + dx, chY + dy);
      }
    }
  }

  // Entry: carved tile closest to center
  carve(cx, cy);
  carve(cx + 1, cy);
  carve(cx, cy + 1);
  carve(cx + 1, cy + 1);
  const entry = { x: cx, y: cy };
  tiles[entry.y][entry.x] = makeTile(TileType.LadderUp);

  // BFS distances from entry over floor tiles
  const dist = new Int32Array(w * h).fill(-1);
  const queue: number[] = [entry.y * w + entry.x];
  dist[queue[0]] = 0;
  let far = queue[0];
  while (queue.length) {
    const cur = queue.shift()!;
    if (dist[cur] > dist[far]) far = cur;
    const x = cur % w;
    const y = Math.floor(cur / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (dist[ni] !== -1) continue;
      const tt = tiles[ny][nx].type;
      if (tt !== TileType.CaveFloor && tt !== TileType.LadderUp) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }

  let ladderDown: { x: number; y: number } | null = null;
  let throneGate: { x: number; y: number } | null = null;
  let throneCenter: { x: number; y: number } | null = null;

  if (floor < 3) {
    ladderDown = { x: far % w, y: Math.floor(far / w) };
    tiles[ladderDown.y][ladderDown.x] = makeTile(TileType.LadderDown);
  } else {
    // Throne arena: 13x11 room around the farthest point, clamped inside
    const fx = Math.max(8, Math.min(w - 9, far % w));
    const fy = Math.max(7, Math.min(h - 8, Math.floor(far / w)));
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const inWall = Math.abs(dx) === 6 || Math.abs(dy) === 5;
        const t = inWall ? TileType.CaveRock : TileType.CaveFloor;
        tiles[fy + dy][fx + dx] = makeTile(t);
      }
    }
    // Gate: a 3-wide opening on the side facing the entry, sealed with ThroneGate
    const gateX = fx - 6 * (Math.sign(fx - cx) || 1);
    for (let dy = -1; dy <= 1; dy++) {
      tiles[fy + dy][gateX] = makeTile(TileType.ThroneGate);
    }
    // Guaranteed L-shaped approach corridor: from the gate away from the
    // arena to the entry column, then along it to the entry. Keeps the gate
    // always reachable no matter where the walkers wandered.
    const dir = -Math.sign(fx - gateX) || -1; // away from the arena
    for (let ax = gateX + dir; ax !== cx; ax += dir) {
      carve(ax, fy - 1);
      carve(ax, fy);
      carve(ax, fy + 1);
      if (ax < 2 || ax > w - 3) break;
    }
    const vdir = Math.sign(cy - fy) || 1;
    for (let ay = fy; ay !== cy; ay += vdir) {
      carve(cx, ay);
      carve(cx - 1, ay);
    }
    throneGate = { x: gateX, y: fy };
    throneCenter = { x: fx, y: fy };
  }

  // Treasure vaults: small rock-ringed rooms with a chest + torch
  const vaults = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < vaults; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const vx = 6 + Math.floor(rand() * (w - 12));
      const vy = 6 + Math.floor(rand() * (h - 12));
      if (tiles[vy][vx].type !== TileType.CaveRock) continue;
      if (throneCenter && Math.hypot(vx - throneCenter.x, vy - throneCenter.y) < 12) continue;
      if (Math.hypot(vx - entry.x, vy - entry.y) < 8) continue;
      // 5x5: rock ring stays, interior floor, chest center, torch beside it
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          tiles[vy + dy][vx + dx] = makeTile(TileType.CaveFloor);
        }
      }
      tiles[vy][vx] = makeTile(TileType.VaultChest);
      tiles[vy][vx - 1] = makeTile(TileType.Torch);
      break;
    }
  }

  // Ores on rock adjacent to floor (mineable from the corridors)
  const oreSpots: { x: number; y: number }[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (tiles[y][x].type !== TileType.CaveRock) continue;
      const nearFloor =
        tiles[y - 1][x].type === TileType.CaveFloor ||
        tiles[y + 1][x].type === TileType.CaveFloor ||
        tiles[y][x - 1].type === TileType.CaveFloor ||
        tiles[y][x + 1].type === TileType.CaveFloor;
      if (nearFloor) oreSpots.push({ x, y });
    }
  }
  // Shuffle
  for (let i = oreSpots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [oreSpots[i], oreSpots[j]] = [oreSpots[j], oreSpots[i]];
  }
  const take = (n: number, type: TileType) => {
    for (let i = 0; i < n; i++) {
      const spot = oreSpots.pop();
      if (!spot) return;
      tiles[spot.y][spot.x] = makeTile(type);
    }
  };
  take(10, TileType.IronOre);
  take(floor >= 2 ? 6 : 3, TileType.GoldOre);
  take(floor === 1 ? 0 : 12 + floor * 4, TileType.CrystalOre);
  take(floor === 3 ? 12 : 0, TileType.ObsidianOre);
  take(6, TileType.Stone);

  // Lava pools on floors 2+
  if (floor >= 2) {
    const pools = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < pools; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const px = 5 + Math.floor(rand() * (w - 10));
        const py = 5 + Math.floor(rand() * (h - 10));
        if (tiles[py][px].type !== TileType.CaveFloor) continue;
        if (Math.hypot(px - entry.x, py - entry.y) < 7) continue;
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            if (tiles[py + dy][px + dx].type === TileType.CaveFloor && rand() < 0.8) {
              tiles[py + dy][px + dx] = makeTile(TileType.Lava);
            }
          }
        }
        break;
      }
    }
  }

  // A few mushrooms for ambience
  for (let i = 0; i < 8; i++) {
    const mx = 3 + Math.floor(rand() * (w - 6));
    const my = 3 + Math.floor(rand() * (h - 6));
    if (tiles[my][mx].type === TileType.CaveFloor && !(mx === entry.x && my === entry.y)) {
      tiles[my][mx] = makeTile(TileType.Mushroom);
    }
  }

  return { tiles, entry, ladderDown, throneGate, throneCenter };
}
