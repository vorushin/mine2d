export const TILE_SIZE = 32;
export const WORLD_WIDTH = 100;
export const WORLD_HEIGHT = 100;

// Mist barrier — the playable region starts as a centered square and expands outward.
export const INITIAL_REVEAL_HALF_SIZE = 20;
export const REVEAL_EXPAND_DAYS = 2;
export const REVEAL_RING_TILES = 3;
export const REVEAL_TILE_INTERVAL_MS = 40;

export const DAY_DURATION_MS = 3 * 60 * 1000;
export const NIGHT_DURATION_MS = 2 * 60 * 1000;
export const DUSK_DURATION_MS = 5 * 1000;
export const DAWN_DURATION_MS = 5 * 1000;

export const PLAYER_MAX_HP = 100;
export const PLAYER_SPEED = 140;
export const PLAYER_REACH_TILES = 2;

export const INVENTORY_STACK_MAX = 999;

export const ZOMBIE_BASE_HP = 14;
export const ZOMBIE_BASE_DAMAGE = 6;
export const ZOMBIE_BASE_SPEED = 44;
export const ZOMBIE_BASE_SPAWN_PER_NIGHT = 20;
export const ZOMBIE_SPAWN_RAMP_PER_NIGHT = 10;

export const TURRET_BASIC_RANGE = 5 * TILE_SIZE;
export const TURRET_BASIC_FIRE_MS = 800;
export const TURRET_BASIC_DAMAGE = 5;
export const TURRET_ADVANCED_RANGE = 6 * TILE_SIZE;
export const TURRET_ADVANCED_FIRE_MS = 500;
export const TURRET_ADVANCED_DAMAGE = 10;

export const TURRET_FLAME_RANGE = 3 * TILE_SIZE;
export const TURRET_FLAME_FIRE_MS = 600;
export const TURRET_FLAME_DAMAGE = 8;

export const PROJECTILE_SPEED = 360;

// Engineering
export const BOMB_DAMAGE = 60;
export const BOMB_RADIUS = 2;
export const BOMB_FUSE_MS = 1000;
export const BOMB_THROW_SPEED = 280;

// Brute-zombie spawn chance, indexed by (nightNumber - 1). Values beyond the array use the last entry.
export const BRUTE_CHANCE_BY_NIGHT = [0, 0, 0, 0, 0.15, 0.15, 0.15, 0.30];

export const LAVA_DPS = 30;

export const COLORS = {
  sky: 0x0e1116,
  grass: 0x5bbd5b,
  grass_alt: 0x4ca64a,
  dirt: 0x7a4a2b,
  tree: 0x2e7d32,
  tree_trunk: 0x5a3a1b,
  stone: 0x888888,
  iron_ore: 0xc9b037,
  gold_ore: 0xffd700,
  wall_wood: 0x9c6a3f,
  wall_stone: 0x707070,
  wall_iron: 0xb0b0c0,
  door_wood: 0x5e3a1b,
  door_iron: 0x8a8aa0,
  door_open: 0x3a2410,
  lava: 0xff4d1a,
  lava_glow: 0xffb347,
  torch: 0xffd27a,
  crafting_bench: 0xb5651d,
  chest: 0x6b4423,
  turret_basic: 0x4d7fff,
  turret_advanced: 0x8040ff,
  turret_flame: 0xff8030,
  wall_reinforced: 0x5a5a70,
  mist: 0x1a1d26,
  bomb: 0x2a2a2a,
  shop_npc: 0xffcc00,
  player: 0xff4d4d,
  zombie: 0x3d7a3d,
  zombie_outline: 0x1a3a1a,
  arrow: 0xf2f2f2,
  bullet: 0xffaa00,
  night_overlay: 0x060612,
} as const;

export const DEFAULT_RECT = 0xffffff;
