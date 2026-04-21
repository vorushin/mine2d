import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';
import { TileType, TILE_SPECS } from './tileTypes';

export interface Tile {
  type: TileType;
  hp: number;
}

export interface GeneratedWorld {
  tiles: Tile[][];
  playerSpawn: { x: number; y: number };
  shopPos: { x: number; y: number };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTile(type: TileType): Tile {
  return { type, hp: TILE_SPECS[type].baseHp };
}

/**
 * Simple value noise: random value per integer grid cell, bilinearly interpolated.
 * Deterministic given the seed.
 */
function noise2d(seed: number) {
  const cache = new Map<number, number>();
  const hash = (x: number, y: number) => {
    const k = x * 73856093 + y * 19349663 + seed * 83492791;
    let h = cache.get(k);
    if (h === undefined) {
      let s = k | 0;
      s = (s ^ (s >>> 13)) * 1274126177;
      s = (s ^ (s >>> 16)) >>> 0;
      h = s / 0xffffffff;
      cache.set(k, h);
    }
    return h;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const tl = hash(xi, yi);
    const tr = hash(xi + 1, yi);
    const bl = hash(xi, yi + 1);
    const br = hash(xi + 1, yi + 1);
    const top = tl + (tr - tl) * xf;
    const bot = bl + (br - bl) * xf;
    return top + (bot - top) * yf;
  };
}

export function generateWorld(seed: number): GeneratedWorld {
  const rand = mulberry32(seed);
  const biomeNoise = noise2d(seed + 1);
  const detailNoise = noise2d(seed + 2);
  const w = WORLD_WIDTH;
  const h = WORLD_HEIGHT;

  // Initialize all grass
  const tiles: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < w; x++) row.push(makeTile(TileType.Grass));
    tiles.push(row);
  }

  // Biome pass — low-frequency noise picks the base terrain for each tile
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Keep a grass border
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
      const nb = biomeNoise(x / 14, y / 14);
      const nd = detailNoise(x / 5, y / 5);
      // Carve a lake in one region
      if (nb < 0.22) {
        tiles[y][x] = makeTile(TileType.Water);
      } else if (nb < 0.28) {
        tiles[y][x] = makeTile(TileType.Sand);
      } else if (nb > 0.8) {
        // Rocky mountain region — stone clusters
        if (nd > 0.45) tiles[y][x] = makeTile(TileType.Stone);
        else if (nd < 0.15) tiles[y][x] = makeTile(TileType.Dirt);
      } else if (nb > 0.72) {
        // Hilly dirt
        if (nd > 0.5) tiles[y][x] = makeTile(TileType.Dirt);
      } else if (nb > 0.55 && nb < 0.6 && nd > 0.6) {
        // Small flower-field patches
        tiles[y][x] = makeTile(TileType.FlowerField);
      }
    }
  }

  // Sand rim around water to feel like a beach
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (tiles[y][x].type !== TileType.Grass) continue;
      let nearWater = false;
      for (let dy = -1; dy <= 1 && !nearWater; dy++) {
        for (let dx = -1; dx <= 1 && !nearWater; dx++) {
          if (tiles[y + dy]?.[x + dx]?.type === TileType.Water) nearWater = true;
        }
      }
      if (nearWater && rand() < 0.85) tiles[y][x] = makeTile(TileType.Sand);
    }
  }

  // Trees: mostly in mid-biome (grass, not in rocky region)
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      if (tiles[y][x].type !== TileType.Grass) continue;
      const nb = biomeNoise(x / 14, y / 14);
      if (nb > 0.8) continue; // skip mountains
      const r = rand();
      if (nb > 0.4 && nb < 0.72 && r < 0.1) {
        tiles[y][x] = makeTile(TileType.Tree);
      } else if (nb > 0.72 && r < 0.03) {
        tiles[y][x] = makeTile(TileType.DeadTree);
      }
    }
  }

  // Sprinkle ores in mountain regions
  for (let i = 0; i < 18; i++) {
    const cx = 4 + Math.floor(rand() * (w - 8));
    const cy = 4 + Math.floor(rand() * (h - 8));
    const t = tiles[cy][cx];
    if (t.type === TileType.Stone || t.type === TileType.Grass) {
      tiles[cy][cx] = makeTile(TileType.IronOre);
      if (rand() < 0.5) {
        const nx = cx + (rand() < 0.5 ? -1 : 1);
        const ny = cy + (rand() < 0.5 ? -1 : 1);
        if (inBounds(nx, ny) && (tiles[ny][nx].type === TileType.Stone || tiles[ny][nx].type === TileType.Grass)) {
          tiles[ny][nx] = makeTile(TileType.IronOre);
        }
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    const cx = 4 + Math.floor(rand() * (w - 8));
    const cy = 4 + Math.floor(rand() * (h - 8));
    const t = tiles[cy][cx];
    if (t.type === TileType.Stone || t.type === TileType.Grass) {
      tiles[cy][cx] = makeTile(TileType.GoldOre);
    }
  }

  // Mushroom clusters in shady forest
  for (let i = 0; i < 12; i++) {
    const cx = 4 + Math.floor(rand() * (w - 8));
    const cy = 4 + Math.floor(rand() * (h - 8));
    if (tiles[cy][cx].type === TileType.Grass && biomeNoise(cx / 14, cy / 14) < 0.6) {
      tiles[cy][cx] = makeTile(TileType.Mushroom);
    }
  }

  // Pumpkin patches in sand/flower areas
  for (let i = 0; i < 6; i++) {
    const cx = 4 + Math.floor(rand() * (w - 8));
    const cy = 4 + Math.floor(rand() * (h - 8));
    const t = tiles[cy][cx];
    if (t.type === TileType.Grass || t.type === TileType.Sand) {
      tiles[cy][cx] = makeTile(TileType.Pumpkin);
    }
  }

  // Pre-built campfire in a central grass area
  for (let tries = 0; tries < 50; tries++) {
    const cx = Math.floor(w / 2) + Math.floor((rand() - 0.5) * 12);
    const cy = Math.floor(h / 2) + Math.floor((rand() - 0.5) * 12);
    if (tiles[cy][cx].type === TileType.Grass) {
      tiles[cy][cx] = makeTile(TileType.Campfire);
      break;
    }
  }

  // Easter-egg birthday cake somewhere
  for (let tries = 0; tries < 60; tries++) {
    const cx = 4 + Math.floor(rand() * (w - 8));
    const cy = 4 + Math.floor(rand() * (h - 8));
    if (tiles[cy][cx].type === TileType.Grass) {
      tiles[cy][cx] = makeTile(TileType.Cake);
      break;
    }
  }

  // Player spawn — find open grass near center
  const spawn = findOpenSpot(tiles, rand, Math.floor(w / 2), Math.floor(h / 2));

  // Shop — place a bit away from spawn on open ground
  let shopPos = { x: 0, y: 0 };
  for (let tries = 0; tries < 300; tries++) {
    const angle = rand() * Math.PI * 2;
    const dist = 6 + rand() * 12;
    const sx = Math.floor(spawn.x + Math.cos(angle) * dist);
    const sy = Math.floor(spawn.y + Math.sin(angle) * dist);
    if (inBounds(sx, sy) && tiles[sy][sx].type === TileType.Grass) {
      tiles[sy][sx] = makeTile(TileType.ShopNPC);
      shopPos = { x: sx, y: sy };
      break;
    }
  }

  // Place a starter chest near spawn (not on top of spawn)
  for (let tries = 0; tries < 40; tries++) {
    const angle = rand() * Math.PI * 2;
    const dist = 3 + rand() * 2;
    const cx = Math.floor(spawn.x + Math.cos(angle) * dist);
    const cy = Math.floor(spawn.y + Math.sin(angle) * dist);
    if (inBounds(cx, cy) && tiles[cy][cx].type === TileType.Grass) {
      tiles[cy][cx] = makeTile(TileType.Chest);
      break;
    }
  }

  // Clear 3x3 around spawn to plain grass (tight circle so player always has a clear start).
  // Outer ring (5x5 radius) softens hazards only.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = spawn.x + dx;
      const ny = spawn.y + dy;
      if (!inBounds(nx, ny)) continue;
      tiles[ny][nx] = makeTile(TileType.Grass);
    }
  }
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = spawn.x + dx;
      const ny = spawn.y + dy;
      if (!inBounds(nx, ny)) continue;
      const t = tiles[ny][nx];
      if (t.type === TileType.Water || t.type === TileType.Lava) {
        tiles[ny][nx] = makeTile(TileType.Sand);
      }
    }
  }

  // Guarantee at least one tree and one stone within ~6 tiles of spawn (for immediate playability)
  ensureNear(tiles, rand, spawn, TileType.Tree, 6, 3);
  ensureNear(tiles, rand, spawn, TileType.Stone, 8, 3);

  return { tiles, playerSpawn: spawn, shopPos };
}

function ensureNear(tiles: Tile[][], rand: () => number, spawn: { x: number; y: number }, type: TileType, radius: number, count: number) {
  let placed = 0;
  // First check if they already exist
  for (let y = spawn.y - radius; y <= spawn.y + radius && placed < count; y++) {
    for (let x = spawn.x - radius; x <= spawn.x + radius && placed < count; x++) {
      if (!inBounds(x, y)) continue;
      if (tiles[y][x].type === type) placed++;
    }
  }
  // Place more if needed
  for (let tries = 0; tries < 40 && placed < count; tries++) {
    const x = spawn.x + Math.floor((rand() - 0.5) * 2 * radius);
    const y = spawn.y + Math.floor((rand() - 0.5) * 2 * radius);
    if (!inBounds(x, y)) continue;
    if (tiles[y][x].type === TileType.Grass && Math.hypot(x - spawn.x, y - spawn.y) > 2) {
      tiles[y][x] = makeTile(type);
      placed++;
    }
  }
}

function findOpenSpot(tiles: Tile[][], rand: () => number, cx: number, cy: number): { x: number; y: number } {
  for (let r = 0; r < 20; r++) {
    for (let tries = 0; tries < 30; tries++) {
      const x = cx + Math.floor((rand() - 0.5) * 2 * (r + 1));
      const y = cy + Math.floor((rand() - 0.5) * 2 * (r + 1));
      if (inBounds(x, y) && tiles[y][x].type === TileType.Grass) return { x, y };
    }
  }
  return { x: cx, y: cy };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT;
}
