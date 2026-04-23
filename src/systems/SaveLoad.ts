import { GameState, RunStats, makeGameState } from '../state/GameState';
import { Tile } from '../world/generate';
import { TileType, TILE_SPECS, MaterialId } from '../world/tileTypes';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';

/**
 * Save format — forward-compatible.
 *
 * Philosophy: every field is optional on load. Old saves gain new fields
 * with sensible defaults. Saves from newer versions of the game load as
 * best as possible; fields we don't recognize are dropped silently.
 *
 * Tile types are enum numbers — if future versions renumber them, old
 * saves would break; to avoid that, we serialize tile types as lowercase
 * string names (e.g. "grass", "volcano"). A map converts back to the
 * current enum. Unknown names fall back to "grass".
 */

const SAVE_KEY = 'mine2d:save_v1';
export const CURRENT_SAVE_VERSION = 1;

// --- Tile name ↔ enum mapping (stable across refactors) --------------------

const TILE_NAMES: Record<TileType, string> = {
  [TileType.Grass]: 'grass',
  [TileType.Dirt]: 'dirt',
  [TileType.Tree]: 'tree',
  [TileType.Stone]: 'stone',
  [TileType.IronOre]: 'iron_ore',
  [TileType.GoldOre]: 'gold_ore',
  [TileType.WallWood]: 'wall_wood',
  [TileType.WallStone]: 'wall_stone',
  [TileType.WallIron]: 'wall_iron',
  [TileType.DoorWood]: 'door_wood',
  [TileType.DoorIron]: 'door_iron',
  [TileType.Lava]: 'lava',
  [TileType.Torch]: 'torch',
  [TileType.CraftingBench]: 'crafting_bench',
  [TileType.Chest]: 'chest',
  [TileType.TurretBasic]: 'turret_basic',
  [TileType.TurretAdvanced]: 'turret_advanced',
  [TileType.ShopNPC]: 'shop_npc',
  [TileType.Water]: 'water',
  [TileType.Sand]: 'sand',
  [TileType.DeadTree]: 'dead_tree',
  [TileType.Campfire]: 'campfire',
  [TileType.Cake]: 'cake',
  [TileType.FlowerField]: 'flower_field',
  [TileType.Mushroom]: 'mushroom',
  [TileType.Pumpkin]: 'pumpkin',
  [TileType.Volcano]: 'volcano',
  [TileType.Crater]: 'crater',
  [TileType.Bridge]: 'bridge',
  [TileType.WallReinforced]: 'wall_reinforced',
  [TileType.TurretFlame]: 'turret_flame',
};

const NAME_TO_TILE: Record<string, TileType> = Object.fromEntries(
  (Object.entries(TILE_NAMES) as [string, string][]).map(([k, v]) => [v, Number(k) as TileType])
);

function tileNameFor(t: TileType): string {
  return TILE_NAMES[t] ?? 'grass';
}

function tileFromName(name: unknown): TileType {
  if (typeof name === 'string' && name in NAME_TO_TILE) return NAME_TO_TILE[name];
  return TileType.Grass;
}

// --- Serialization ---------------------------------------------------------

export interface SaveData {
  version: number;
  timestamp: number;
  world: {
    width: number;
    height: number;
    tiles: { t: string; h: number }[];
    playerSpawn: { x: number; y: number };
    shopPos: { x: number; y: number };
  };
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    pickaxeTier: number;
    swordTier: number;
    hasBow: boolean;
    hasPistol: boolean;
    hasHammer: boolean;
    hotbarSlot: number;
    inventory: Record<string, number>;
  };
  cycle: {
    phase: GameState['phase'];
    phaseElapsedMs: number;
    nightNumber: number;
    score: number;
  };
  stats: RunStats;
  dog: { alive: boolean; hp: number; level: number; kills: number; x: number; y: number } | null;
}

export interface SaveSnapshot {
  state: GameState;
  tiles: Tile[][];
  playerSpawn: { x: number; y: number };
  shopPos: { x: number; y: number };
  playerWorldPos: { x: number; y: number };
  dog: { alive: boolean; hp: number; level: number; kills: number; x: number; y: number } | null;
}

export const SaveLoad = {
  hasSave(): boolean {
    try { return !!localStorage.getItem(SAVE_KEY); }
    catch { return false; }
  },

  save(snapshot: SaveSnapshot): boolean {
    try {
      const data = serialize(snapshot);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  /** Best-effort load. Returns null if absent/unrecoverable. */
  load(): SaveSnapshot | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return deserialize(parsed);
    } catch {
      return null;
    }
  },

  clear(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
  },

  /** When the save was made (for UI display). */
  savedAt(): Date | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { timestamp?: number };
      return parsed?.timestamp ? new Date(parsed.timestamp) : null;
    } catch {
      return null;
    }
  },
};

function serialize(snap: SaveSnapshot): SaveData {
  const flat: { t: string; h: number }[] = [];
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tile = snap.tiles[y][x];
      flat.push({ t: tileNameFor(tile.type), h: tile.hp });
    }
  }
  return {
    version: CURRENT_SAVE_VERSION,
    timestamp: Date.now(),
    world: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      tiles: flat,
      playerSpawn: { x: snap.playerSpawn.x, y: snap.playerSpawn.y },
      shopPos: { x: snap.shopPos.x, y: snap.shopPos.y },
    },
    player: {
      x: snap.playerWorldPos.x,
      y: snap.playerWorldPos.y,
      hp: snap.state.playerHp,
      maxHp: snap.state.playerMaxHp,
      pickaxeTier: snap.state.pickaxeTier,
      swordTier: snap.state.swordTier,
      hasBow: snap.state.hasBow,
      hasPistol: snap.state.hasPistol,
      hasHammer: snap.state.hasHammer,
      hotbarSlot: snap.state.hotbarSlot,
      inventory: { ...snap.state.inventory.counts } as Record<string, number>,
    },
    cycle: {
      phase: snap.state.phase,
      phaseElapsedMs: snap.state.phaseElapsedMs,
      nightNumber: snap.state.nightNumber,
      score: snap.state.score,
    },
    stats: { ...snap.state.stats },
    dog: snap.dog,
  };
}

// --- Defensive field readers ----------------------------------------------

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function intOr(v: unknown, fallback: number): number {
  return Number.isFinite(v as number) ? Math.floor(v as number) : fallback;
}
function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function stringOr<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;
}

const VALID_PHASES = ['day', 'dusk', 'night', 'dawn'] as const;
const VALID_MATERIALS: readonly MaterialId[] = [
  'wood', 'stone', 'iron', 'gold', 'arrow', 'bullet', 'lava', 'potion', 'food',
  'bomb', 'wallReinforced', 'turretFlame',
];

function deserialize(raw: unknown): SaveSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SaveData>;

  // Version gate: accept current version and anything lower (upward best-effort).
  // Future higher versions still read, but unknown extra fields are simply ignored.
  const version = numberOr(data.version, 0);
  if (version < 1) return null; // Not a recognized save

  const world = data.world ?? ({} as Partial<SaveData['world']>);
  const savedWidth = numberOr(world.width, WORLD_WIDTH);
  const savedHeight = numberOr(world.height, WORLD_HEIGHT);
  const flat = Array.isArray(world.tiles) ? (world.tiles as unknown[]) : [];

  const tiles: Tile[][] = [];
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      // Map saved coords back. If the saved world had different dimensions,
      // only overlap is preserved; the rest becomes grass.
      let tileType: TileType = TileType.Grass;
      let hp = 0;
      if (x < savedWidth && y < savedHeight) {
        const idx = y * savedWidth + x;
        const cell = flat[idx];
        if (cell && typeof cell === 'object') {
          const c = cell as { t?: unknown; h?: unknown };
          tileType = tileFromName(c.t);
          hp = numberOr(c.h, TILE_SPECS[tileType]?.baseHp ?? 0);
        }
      }
      row.push({ type: tileType, hp });
    }
    tiles.push(row);
  }

  const ps = (world.playerSpawn ?? {}) as { x?: unknown; y?: unknown };
  const playerSpawn = { x: intOr(ps.x, Math.floor(WORLD_WIDTH / 2)), y: intOr(ps.y, Math.floor(WORLD_HEIGHT / 2)) };
  const sh = (world.shopPos ?? {}) as { x?: unknown; y?: unknown };
  const shopPos = { x: intOr(sh.x, 0), y: intOr(sh.y, 0) };

  const p = (data.player ?? {}) as Partial<SaveData['player']>;
  const maxHp = Math.max(50, numberOr(p.maxHp, 100));
  const inventorySrc = (p.inventory ?? {}) as Record<string, unknown>;
  const inventory: Partial<Record<MaterialId, number>> = {};
  for (const m of VALID_MATERIALS) {
    const raw = inventorySrc[m];
    const n = Math.max(0, intOr(raw, 0));
    if (n > 0) inventory[m] = n;
  }

  const cyc = (data.cycle ?? {}) as Partial<SaveData['cycle']>;

  const stats = (data.stats ?? {}) as Partial<RunStats>;

  const state: GameState = makeGameState();
  state.playerMaxHp = maxHp;
  state.playerHp = Math.max(0, Math.min(maxHp, numberOr(p.hp, maxHp)));
  state.pickaxeTier = Math.max(0, Math.min(2, intOr(p.pickaxeTier, 0))) as 0 | 1 | 2;
  state.swordTier = Math.max(0, Math.min(1, intOr(p.swordTier, 0))) as 0 | 1;
  state.hasBow = boolOr(p.hasBow, false);
  state.hasPistol = boolOr(p.hasPistol, false);
  state.hasHammer = boolOr(p.hasHammer, false);
  state.hotbarSlot = Math.max(0, intOr(p.hotbarSlot, 0));
  state.inventory.counts = inventory;
  state.phase = stringOr(cyc.phase, VALID_PHASES, 'day');
  state.phaseElapsedMs = Math.max(0, numberOr(cyc.phaseElapsedMs, 0));
  state.nightNumber = Math.max(1, intOr(cyc.nightNumber, 1));
  state.score = Math.max(0, intOr(cyc.score, 0));
  state.stats = {
    zombiesKilled: Math.max(0, intOr(stats.zombiesKilled, 0)),
    tilesMined: Math.max(0, intOr(stats.tilesMined, 0)),
    tilesPlaced: Math.max(0, intOr(stats.tilesPlaced, 0)),
    goldEarned: Math.max(0, intOr(stats.goldEarned, 0)),
  };
  state.running = true;

  // Player world position; if absent, use spawn.
  const playerWorldPos = {
    x: numberOr(p.x, playerSpawn.x * 32 + 16),
    y: numberOr(p.y, playerSpawn.y * 32 + 16),
  };

  // Dog (may be null or missing entirely)
  let dog: SaveSnapshot['dog'] = null;
  if (data.dog && typeof data.dog === 'object') {
    const d = data.dog as Partial<NonNullable<SaveData['dog']>>;
    dog = {
      alive: boolOr(d.alive, true),
      hp: Math.max(0, numberOr(d.hp, 60)),
      level: Math.max(1, intOr(d.level, 1)),
      kills: Math.max(0, intOr(d.kills, 0)),
      x: numberOr(d.x, playerWorldPos.x + 18),
      y: numberOr(d.y, playerWorldPos.y + 6),
    };
  }

  return { state, tiles, playerSpawn, shopPos, playerWorldPos, dog };
}
