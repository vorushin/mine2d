/**
 * Campaign mode: a hand-authored road of 6 worlds × 3 levels. Each level is a
 * small puzzle/task run on a fixed seed with scripted nights, and each one
 * adds new tools/recipes/shop stock to the pool — the campaign starts with a
 * bare pickaxe and ends with wands, obsidian, and the Zombie King.
 *
 * Pure data & math — no Phaser. The scene owns spawning/effects; this module
 * owns definitions, unlock resolution, and objective evaluation.
 */

import type { GameState } from '../state/GameState';
import { MaterialId, TileType } from '../world/tileTypes';
import type { ZombieVariant } from '../entities/Zombie';
import type { NightTwistKind } from './NightTwists';
import type { BossKind } from './Bosses';
import type { CompanionId, ModifierId } from './MetaStore';
import { HOTBAR } from '../ui/hotbarDef';
import { RECIPES } from './Crafting';
import { SHOP_OFFERS } from './Shop';

// --- Objectives ---------------------------------------------------------------

export type CampaignObjectiveDef =
  | { kind: 'collect'; material: MaterialId; count: number }
  | { kind: 'mine'; count: number }
  | { kind: 'build'; count: number; tile?: TileType; what?: string }
  | { kind: 'kill'; count: number; variant?: ZombieVariant }
  | { kind: 'bossKill'; count: number }
  | { kind: 'survive'; nights: number }
  | { kind: 'upgrade'; what: 'pickaxe' | 'sword'; tier: number; label: string }
  | { kind: 'own'; what: 'bow' | 'pistol' | 'hammer' | 'freezeWand' | 'stormWand' | 'rod' | 'crystalKey'; label: string }
  | { kind: 'depth'; depth: 1 | 2 | 3 }
  | { kind: 'graveyards'; count: number }
  | { kind: 'fish'; count: number }
  | { kind: 'victory' };

const OWN_FLAG: Record<Extract<CampaignObjectiveDef, { kind: 'own' }>['what'], keyof GameState> = {
  bow: 'hasBow',
  pistol: 'hasPistol',
  hammer: 'hasHammer',
  freezeWand: 'hasFreezeWand',
  stormWand: 'hasStormWand',
  rod: 'hasRod',
  crystalKey: 'hasCrystalKey',
};

export function objectiveGoal(def: CampaignObjectiveDef): number {
  switch (def.kind) {
    case 'collect': return def.count;
    case 'mine': return def.count;
    case 'build': return def.count;
    case 'kill': return def.count;
    case 'bossKill': return def.count;
    case 'survive': return def.nights;
    case 'upgrade': return 1;
    case 'own': return 1;
    case 'depth': return def.depth;
    case 'graveyards': return def.count;
    case 'fish': return def.count;
    case 'victory': return 1;
  }
}

/** Live progress toward an objective, straight from the run state (uncapped). */
export function objectiveProgress(def: CampaignObjectiveDef, state: GameState): number {
  const camp = state.campaign;
  switch (def.kind) {
    case 'collect': return state.inventory.counts[def.material] ?? 0;
    case 'mine': return state.stats.tilesMined;
    case 'build':
      if (def.tile === undefined) return state.stats.tilesPlaced;
      return camp?.counters.buildByTile[def.tile] ?? 0;
    case 'kill':
      if (!def.variant) return state.stats.zombiesKilled;
      return camp?.counters.killsByVariant[def.variant] ?? 0;
    case 'bossKill': return state.runMeta.bossKills;
    case 'survive': return Math.max(0, state.nightNumber - (camp?.startNight ?? 1));
    case 'upgrade': return (def.what === 'pickaxe' ? state.pickaxeTier : state.swordTier) >= def.tier ? 1 : 0;
    case 'own': return state[OWN_FLAG[def.what]] ? 1 : 0;
    case 'depth': return state.runMeta.maxDepth;
    case 'graveyards': return state.runMeta.graveyardsCleared;
    case 'fish': return camp?.counters.fish ?? 0;
    case 'victory': return state.victory ? 1 : 0;
  }
}

export function objectiveLabel(def: CampaignObjectiveDef): string {
  switch (def.kind) {
    case 'collect': return `Collect ${def.count} ${def.material}`;
    case 'mine': return `Mine ${def.count} tiles`;
    case 'build': return `Build ${def.count} ${def.what ?? 'structures'}`;
    case 'kill': return def.variant ? `Defeat ${def.count} ${def.variant}s` : `Defeat ${def.count} monsters`;
    case 'bossKill': return `Slay ${def.count} boss${def.count === 1 ? '' : 'es'}`;
    case 'survive': return `Survive ${def.nights} night${def.nights === 1 ? '' : 's'}`;
    case 'upgrade': return def.label;
    case 'own': return def.label;
    case 'depth': return `Reach cave floor ${def.depth}`;
    case 'graveyards': return `Cleanse ${def.count} graveyard${def.count === 1 ? '' : 's'}`;
    case 'fish': return `Catch ${def.count} thing${def.count === 1 ? '' : 's'} fishing`;
    case 'victory': return 'Defeat the Zombie King';
  }
}

// --- Level / world definitions -------------------------------------------------

export interface CampaignNight {
  /** Exact zombie count for this night's siege (graveyard bonus still applies). */
  target: number;
  /** Spawn a boss this night — a specific kind, or `true` for the standard rotation. */
  boss?: Exclude<BossKind, 'king'> | true;
  twist?: NightTwistKind;
}

export interface CampaignUnlockDelta {
  /** HOTBAR labels newly available from this level on. */
  hotbar?: string[];
  /** Recipe ids newly craftable from this level on. */
  recipes?: string[];
  /** Shop offer ids newly stocked from this level on. */
  shop?: string[];
  /** The Deep Dark opens from this level on. */
  caves?: boolean;
}

export interface CampaignLevelDef {
  id: string;
  world: number;
  title: string;
  blurb: string;
  seed: number;
  worldModifier: ModifierId | null;
  /** nightNumber at level start — the difficulty dial (later nights = meaner zombies). */
  startNight: number;
  maxHp: number;
  start?: Partial<Pick<GameState,
    'pickaxeTier' | 'swordTier' | 'hasBow' | 'hasPistol' | 'hasHammer' |
    'hasFreezeWand' | 'hasStormWand' | 'hasRod' | 'hasCrystalKey'>>;
  startInventory: Partial<Record<MaterialId, number>>;
  buddy?: CompanionId;
  /** Night i (counted from startNight) uses entry min(i, length-1). Empty = classic pacing. */
  nights: CampaignNight[];
  objectives: CampaignObjectiveDef[];
  unlocks: CampaignUnlockDelta;
  /** Finish within this many survived nights for 3 stars (+1 → 2 stars). */
  parNights: number;
  /** Star Coins banked on first completion. */
  reward: number;
}

export interface CampaignWorldDef {
  index: number;
  name: string;
  tagline: string;
  /** Texture key for the map card. */
  icon: string;
  accent: number;
}

export const CAMPAIGN_WORLDS: CampaignWorldDef[] = [
  { index: 1, name: 'GREEN MEADOWS', tagline: 'Learn the ropes: mine, build, survive the dark.', icon: 'tree', accent: 0x5bbd5b },
  { index: 2, name: 'STONECRAG HILLS', tagline: 'Craft your way from stone to iron.', icon: 'iron_ore', accent: 0xc9b037 },
  { index: 3, name: 'SALTWIND ISLES', tagline: 'Gold, trade, bridges — and a lot of water.', icon: 'bridge', accent: 0x3e6db0 },
  { index: 4, name: 'RUSTWORKS', tagline: 'Automate your defenses. Hold the line.', icon: 'turret_basic', accent: 0xff8030 },
  { index: 5, name: 'THE DEEP DARK', tagline: 'Descend. Carry light. Come back rich.', icon: 'crystal_ore', accent: 0x7fe7ff },
  { index: 6, name: 'THE CROWN', tagline: 'Blood moons, lost souls, and the Zombie King.', icon: 'zombie_king', accent: 0xc46aff },
];

const STARTER_KIT = { wood: 12, stone: 4 } as const;

export const CAMPAIGN_LEVELS: CampaignLevelDef[] = [
  // ---- World 1: GREEN MEADOWS — bare hands, first walls, first nights --------
  {
    id: 'w1-1',
    world: 1,
    title: 'First Steps',
    blurb: 'Every hero starts by mining trees and rocks. The nights are quiet… for now.',
    seed: 110001,
    worldModifier: null,
    startNight: 1,
    maxHp: 100,
    startInventory: {},
    nights: [{ target: 0 }],
    objectives: [
      { kind: 'collect', material: 'wood', count: 10 },
      { kind: 'collect', material: 'stone', count: 6 },
    ],
    unlocks: { hotbar: ['Pick', 'Sword'] },
    parNights: 0,
    reward: 8,
  },
  {
    id: 'w1-2',
    world: 1,
    title: 'Home Before Dark',
    blurb: 'Tonight they come. Raise walls, hang a door, light a torch.',
    seed: 110002,
    worldModifier: null,
    startNight: 1,
    maxHp: 100,
    startInventory: { ...STARTER_KIT },
    nights: [{ target: 8 }],
    objectives: [
      { kind: 'build', count: 6, tile: TileType.WallWood, what: 'wooden walls' },
      { kind: 'build', count: 1, tile: TileType.DoorWood, what: 'door' },
      { kind: 'build', count: 2, tile: TileType.Torch, what: 'torches' },
      { kind: 'survive', nights: 1 },
    ],
    unlocks: { hotbar: ['Wall W', 'Door', 'Torch'] },
    parNights: 1,
    reward: 8,
  },
  {
    id: 'w1-3',
    world: 1,
    title: 'Spike Season',
    blurb: 'Let the ground fight for you. Lure the horde over your spikes.',
    seed: 110003,
    worldModifier: null,
    startNight: 1,
    maxHp: 100,
    startInventory: { ...STARTER_KIT },
    nights: [{ target: 10 }, { target: 14, twist: 'swarm' }],
    objectives: [
      { kind: 'build', count: 3, tile: TileType.SpikeTrap, what: 'spike traps' },
      { kind: 'kill', count: 12 },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Trap'] },
    parNights: 2,
    reward: 10,
  },

  // ---- World 2: STONECRAG HILLS — the crafting bench opens -------------------
  {
    id: 'w2-1',
    world: 2,
    title: 'The Prospector',
    blurb: 'Wood breaks on iron ore. Craft a stone pickaxe (press C) and dig deeper veins.',
    seed: 220001,
    worldModifier: null,
    startNight: 1,
    maxHp: 100,
    startInventory: { ...STARTER_KIT },
    nights: [{ target: 8 }, { target: 12 }],
    objectives: [
      { kind: 'upgrade', what: 'pickaxe', tier: 1, label: 'Craft a Stone Pickaxe' },
      { kind: 'collect', material: 'iron', count: 6 },
    ],
    unlocks: { hotbar: ['Wall S'], recipes: ['stone_pickaxe', 'iron_pickaxe'] },
    parNights: 1,
    reward: 10,
  },
  {
    id: 'w2-2',
    world: 2,
    title: 'Iron Age',
    blurb: 'Iron tools, iron walls, and a hammer to keep them standing.',
    seed: 220002,
    worldModifier: null,
    startNight: 2,
    maxHp: 100,
    start: { pickaxeTier: 1 },
    startInventory: { ...STARTER_KIT },
    nights: [{ target: 12 }, { target: 16 }],
    objectives: [
      { kind: 'upgrade', what: 'pickaxe', tier: 2, label: 'Craft an Iron Pickaxe' },
      { kind: 'upgrade', what: 'sword', tier: 1, label: 'Craft an Iron Sword' },
      { kind: 'build', count: 6, tile: TileType.WallStone, what: 'stone walls' },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Wall I', 'Hammer'], recipes: ['iron_sword', 'repair_hammer'] },
    parNights: 2,
    reward: 10,
  },
  {
    id: 'w2-3',
    world: 2,
    title: 'Archery 101',
    blurb: 'Runners tonight — too fast for a sword alone. Craft a bow and thin them out.',
    seed: 220003,
    worldModifier: null,
    startNight: 3,
    maxHp: 115,
    start: { pickaxeTier: 2, swordTier: 1 },
    startInventory: { ...STARTER_KIT, iron: 2 },
    nights: [{ target: 14, twist: 'runners' }, { target: 16, twist: 'runners' }],
    objectives: [
      { kind: 'own', what: 'bow', label: 'Craft a Bow' },
      { kind: 'collect', material: 'arrow', count: 15 },
      { kind: 'kill', count: 20 },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Bow'], recipes: ['bow', 'arrows_x5', 'arrows_x20'] },
    parNights: 2,
    reward: 12,
  },

  // ---- World 3: SALTWIND ISLES — the shop opens on a flooded map -------------
  {
    id: 'w3-1',
    world: 3,
    title: 'Gold Rush',
    blurb: 'The shopkeeper finally opens her stall. Gold ore needs your iron pickaxe.',
    seed: 330001,
    worldModifier: 'island',
    startNight: 3,
    maxHp: 115,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true },
    startInventory: { ...STARTER_KIT, arrow: 10 },
    nights: [{ target: 14 }, { target: 16, twist: 'goblins' }],
    objectives: [
      { kind: 'collect', material: 'gold', count: 6 },
      { kind: 'own', what: 'pistol', label: 'Buy the Pistol from the shop' },
    ],
    unlocks: { hotbar: ['Pistol'], shop: ['arrow_x10', 'bullet_x5', 'potion', 'big_potion', 'pistol'] },
    parNights: 2,
    reward: 12,
  },
  {
    id: 'w3-2',
    world: 3,
    title: 'Gone Fishin\'',
    blurb: 'Islands mean water. Bridge the channels, craft a rod, and see what bites.',
    seed: 330002,
    worldModifier: 'island',
    startNight: 3,
    maxHp: 115,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true },
    startInventory: { ...STARTER_KIT, arrow: 10, iron: 2 },
    nights: [{ target: 14 }, { target: 18 }],
    objectives: [
      { kind: 'build', count: 8, tile: TileType.Bridge, what: 'bridges' },
      { kind: 'own', what: 'rod', label: 'Craft a Fishing Rod' },
      { kind: 'fish', count: 2 },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Bridge', 'Rod'], recipes: ['fishing_rod'] },
    parNights: 2,
    reward: 12,
  },
  {
    id: 'w3-3',
    world: 3,
    title: 'Night Market',
    blurb: 'The shop now sells lava. A molten moat makes a wonderful welcome mat.',
    seed: 330003,
    worldModifier: 'island',
    startNight: 4,
    maxHp: 115,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true, hasPistol: true },
    startInventory: { ...STARTER_KIT, arrow: 10, bullet: 5 },
    nights: [{ target: 16, twist: 'treasure' }, { target: 20, twist: 'goblins' }],
    objectives: [
      { kind: 'build', count: 2, tile: TileType.Lava, what: 'lava tiles' },
      { kind: 'kill', count: 25 },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Lava'], shop: ['lava_x1'] },
    parNights: 2,
    reward: 14,
  },

  // ---- World 4: RUSTWORKS — engineering on a volcanic map ---------------------
  {
    id: 'w4-1',
    world: 4,
    title: 'Auto Defense',
    blurb: 'Three volcanoes smoke on the horizon. Let arrow turrets do the night shift.',
    seed: 440001,
    worldModifier: 'lava',
    startNight: 5,
    maxHp: 130,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true, hasHammer: true },
    startInventory: { ...STARTER_KIT, arrow: 15, iron: 3 },
    nights: [{ target: 16 }, { target: 20 }],
    objectives: [
      { kind: 'build', count: 2, tile: TileType.TurretBasic, what: 'arrow turrets' },
      { kind: 'kill', count: 30 },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Turret'] },
    parNights: 2,
    reward: 14,
  },
  {
    id: 'w4-2',
    world: 4,
    title: 'Demolition Day',
    blurb: 'A graveyard feeds the horde every night. Craft bombs and blow the crypt sky-high.',
    seed: 440002,
    worldModifier: 'lava',
    startNight: 5,
    maxHp: 130,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true, hasHammer: true },
    startInventory: { ...STARTER_KIT, arrow: 15, iron: 4 },
    nights: [{ target: 16 }, { target: 20, twist: 'meteors' }],
    objectives: [
      { kind: 'collect', material: 'bomb', count: 3 },
      { kind: 'graveyards', count: 1 },
      { kind: 'survive', nights: 2 },
    ],
    unlocks: { hotbar: ['Bomb'], recipes: ['bomb_x3'] },
    parNights: 2,
    reward: 14,
  },
  {
    id: 'w4-3',
    world: 4,
    title: 'Hold the Line',
    blurb: 'Three swelling sieges. Reinforced walls and a flame turret — or a very short story.',
    seed: 440003,
    worldModifier: 'lava',
    startNight: 6,
    maxHp: 130,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true, hasHammer: true },
    startInventory: { ...STARTER_KIT, arrow: 20, iron: 4 },
    nights: [{ target: 18, twist: 'swarm' }, { target: 22 }, { target: 26, twist: 'swarm' }],
    objectives: [
      { kind: 'build', count: 4, tile: TileType.WallReinforced, what: 'reinforced walls' },
      { kind: 'build', count: 1, tile: TileType.TurretFlame, what: 'flame turret' },
      { kind: 'survive', nights: 3 },
    ],
    unlocks: { hotbar: ['Wall R', 'T Flame'], recipes: ['reinforced_wall_x4', 'flame_turret'] },
    parNights: 3,
    reward: 16,
  },

  // ---- World 5: THE DEEP DARK — the caves open --------------------------------
  {
    id: 'w5-1',
    world: 5,
    title: 'Into the Dark',
    blurb: 'The cave entrance is sealed no more. Bring torches — the dark bites back.',
    seed: 550001,
    worldModifier: null,
    startNight: 6,
    maxHp: 145,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true, hasHammer: true },
    startInventory: { wood: 20, stone: 6, arrow: 20, iron: 2 },
    nights: [{ target: 16 }, { target: 18 }],
    objectives: [
      { kind: 'depth', depth: 2 },
      { kind: 'collect', material: 'crystal', count: 3 },
      { kind: 'kill', count: 15 },
    ],
    unlocks: { caves: true },
    parNights: 2,
    reward: 16,
  },
  {
    id: 'w5-2',
    world: 5,
    title: 'Crystal Age',
    blurb: 'Crystal hums with magic. Forge the sharpest tools — and your first wand.',
    seed: 550002,
    worldModifier: null,
    startNight: 6,
    maxHp: 145,
    start: { pickaxeTier: 2, swordTier: 1, hasBow: true, hasHammer: true },
    startInventory: { wood: 20, stone: 6, arrow: 20, iron: 4, gold: 1 },
    nights: [{ target: 18 }, { target: 20, twist: 'fog' }],
    objectives: [
      { kind: 'upgrade', what: 'pickaxe', tier: 3, label: 'Craft a Crystal Pickaxe' },
      { kind: 'upgrade', what: 'sword', tier: 2, label: 'Craft a Crystal Sword' },
      { kind: 'own', what: 'freezeWand', label: 'Craft the Freeze Wand' },
      { kind: 'kill', count: 20 },
    ],
    unlocks: { hotbar: ['W Frz'], recipes: ['crystal_pickaxe', 'crystal_sword', 'freeze_wand'] },
    parNights: 2,
    reward: 16,
  },
  {
    id: 'w5-3',
    world: 5,
    title: 'Obsidian Heart',
    blurb: 'Floor 3: obsidian, storm magic, and things that have never seen the sun.',
    seed: 550003,
    worldModifier: null,
    startNight: 7,
    maxHp: 145,
    start: { pickaxeTier: 3, swordTier: 2, hasBow: true, hasHammer: true, hasFreezeWand: true },
    startInventory: { wood: 24, stone: 8, arrow: 20, iron: 4, crystal: 3 },
    nights: [{ target: 18 }, { target: 22 }],
    objectives: [
      { kind: 'depth', depth: 3 },
      { kind: 'collect', material: 'obsidian', count: 4 },
      { kind: 'build', count: 2, tile: TileType.WallObsidian, what: 'obsidian walls' },
      { kind: 'own', what: 'stormWand', label: 'Craft the Storm Wand' },
    ],
    unlocks: { hotbar: ['Wall O', 'W Str'], recipes: ['storm_wand'] },
    parNights: 3,
    reward: 18,
  },

  // ---- World 6: THE CROWN — bosses, souls, the King ---------------------------
  {
    id: 'w6-1',
    world: 6,
    title: 'Blood Moon Rising',
    blurb: 'A frozen land under a red moon. Bosses walk every night now.',
    seed: 660001,
    worldModifier: 'winter',
    startNight: 8,
    maxHp: 175,
    start: { pickaxeTier: 3, swordTier: 2, hasBow: true, hasPistol: true, hasHammer: true, hasFreezeWand: true, hasStormWand: true, hasRod: true },
    startInventory: { wood: 20, stone: 10, iron: 6, arrow: 20, bullet: 10, gold: 5 },
    buddy: 'ember',
    nights: [{ target: 14, boss: 'necromancer' }, { target: 16, boss: 'spiderQueen' }],
    objectives: [
      { kind: 'bossKill', count: 2 },
      { kind: 'kill', count: 25 },
    ],
    unlocks: {},
    parNights: 2,
    reward: 20,
  },
  {
    id: 'w6-2',
    world: 6,
    title: 'Souls of the Fallen',
    blurb: 'Bosses drop souls; graveyards feed the dark. Cleanse the land and forge the Crystal Key.',
    seed: 660002,
    worldModifier: 'winter',
    startNight: 8,
    maxHp: 175,
    start: { pickaxeTier: 3, swordTier: 2, hasBow: true, hasPistol: true, hasHammer: true, hasFreezeWand: true, hasStormWand: true, hasRod: true },
    startInventory: { wood: 20, stone: 10, iron: 6, arrow: 20, bullet: 10, gold: 5, crystal: 3, bomb: 3 },
    buddy: 'ember',
    nights: [{ target: 14, boss: 'golem' }, { target: 16, boss: 'necromancer' }, { target: 18, boss: 'spiderQueen' }],
    objectives: [
      { kind: 'collect', material: 'soul', count: 2 },
      { kind: 'graveyards', count: 2 },
      { kind: 'own', what: 'crystalKey', label: 'Forge the Crystal Key' },
    ],
    unlocks: { recipes: ['crystal_key'] },
    parNights: 3,
    reward: 20,
  },
  {
    id: 'w6-3',
    world: 6,
    title: 'The Zombie King',
    blurb: 'The Key burns in your pack. Descend to floor 3, unseal the throne, end this.',
    seed: 660003,
    worldModifier: 'winter',
    startNight: 8,
    maxHp: 175,
    start: { pickaxeTier: 3, swordTier: 2, hasBow: true, hasPistol: true, hasHammer: true, hasFreezeWand: true, hasStormWand: true, hasRod: true, hasCrystalKey: true },
    startInventory: { wood: 24, stone: 12, iron: 8, arrow: 30, bullet: 12, gold: 6, bomb: 3 },
    buddy: 'bolt',
    nights: [{ target: 16 }, { target: 20, boss: 'golem' }, { target: 24 }],
    objectives: [
      { kind: 'victory' },
    ],
    unlocks: {},
    parNights: 3,
    reward: 40,
  },
];

export function levelById(id: string): CampaignLevelDef | null {
  return CAMPAIGN_LEVELS.find((l) => l.id === id) ?? null;
}

export function levelIndexOf(id: string): number {
  return CAMPAIGN_LEVELS.findIndex((l) => l.id === id);
}

export function levelsOfWorld(world: number): CampaignLevelDef[] {
  return CAMPAIGN_LEVELS.filter((l) => l.world === world);
}

// --- Unlock resolution ----------------------------------------------------------

export interface CampaignRules {
  hotbar: string[];
  recipes: string[];
  shop: string[];
  caves: boolean;
}

/** Everything available at level `index`: the union of unlocks up to and including it. */
export function rulesForLevel(index: number): CampaignRules {
  const hotbar = new Set<string>();
  const recipes = new Set<string>();
  const shop = new Set<string>();
  let caves = false;
  for (let i = 0; i <= Math.min(index, CAMPAIGN_LEVELS.length - 1); i++) {
    const u = CAMPAIGN_LEVELS[i].unlocks;
    for (const l of u.hotbar ?? []) hotbar.add(l);
    for (const r of u.recipes ?? []) recipes.add(r);
    for (const s of u.shop ?? []) shop.add(s);
    if (u.caves) caves = true;
  }
  return { hotbar: [...hotbar], recipes: [...recipes], shop: [...shop], caves };
}

/** Human-readable names for what a level newly unlocks (for the map UI). */
export function unlockBadges(def: CampaignLevelDef): string[] {
  const out: string[] = [];
  for (const label of def.unlocks.hotbar ?? []) {
    const act = HOTBAR.find((a) => a.label === label);
    out.push(act ? act.name : label);
  }
  for (const id of def.unlocks.recipes ?? []) {
    const r = RECIPES.find((rec) => rec.id === id);
    if (r) out.push(`Recipe: ${r.label}`);
  }
  for (const id of def.unlocks.shop ?? []) {
    const o = SHOP_OFFERS.find((off) => off.id === id);
    if (o) out.push(`Shop: ${o.label}`);
  }
  if (def.unlocks.caves) out.push('The Deep Dark');
  return out;
}

// --- Run state -------------------------------------------------------------------

export interface CampaignCounters {
  buildByTile: Partial<Record<TileType, number>>;
  killsByVariant: Partial<Record<ZombieVariant, number>>;
  fish: number;
}

export interface CampaignRunState {
  levelId: string;
  rules: CampaignRules;
  /** Parallel to the level def's objectives — done flags latch on. */
  objectives: { done: boolean }[];
  counters: CampaignCounters;
  finished: boolean;
  startNight: number;
}

export function makeCampaignRunState(def: CampaignLevelDef): CampaignRunState {
  return {
    levelId: def.id,
    rules: rulesForLevel(levelIndexOf(def.id)),
    objectives: def.objectives.map(() => ({ done: false })),
    counters: { buildByTile: {}, killsByVariant: {}, fish: 0 },
    finished: false,
    startNight: def.startNight,
  };
}

export interface CampaignTickResult {
  newlyDone: CampaignObjectiveDef[];
  allDone: boolean;
}

/**
 * Latch objective completion from live state. Call every frame; `done` flags
 * never un-set (spending a collected material keeps the objective complete).
 */
export function updateCampaignObjectives(state: GameState): CampaignTickResult | null {
  const camp = state.campaign;
  if (!camp) return null;
  const def = levelById(camp.levelId);
  if (!def) return null;
  const newlyDone: CampaignObjectiveDef[] = [];
  for (let i = 0; i < def.objectives.length; i++) {
    const o = def.objectives[i];
    const slot = camp.objectives[i];
    if (!slot || slot.done) continue;
    if (objectiveProgress(o, state) >= objectiveGoal(o)) {
      slot.done = true;
      newlyDone.push(o);
    }
  }
  return { newlyDone, allDone: camp.objectives.every((o) => o.done) };
}

/** HUD lines for the active level's objectives. */
export function campaignObjectiveLines(state: GameState): { text: string; done: boolean }[] {
  const camp = state.campaign;
  if (!camp) return [];
  const def = levelById(camp.levelId);
  if (!def) return [];
  return def.objectives.map((o, i) => {
    const done = camp.objectives[i]?.done ?? false;
    const goal = objectiveGoal(o);
    const progress = done ? goal : Math.min(goal, objectiveProgress(o, state));
    const counter = goal > 1 ? `  ${progress}/${goal}` : '';
    return { text: `${done ? '✅' : '▫'} ${objectiveLabel(o)}${done ? '' : counter}`, done };
  });
}

// --- Night scripting ---------------------------------------------------------------

/** The scripted plan for a given nightNumber, or null when the level uses classic pacing. */
export function campaignNightPlan(camp: CampaignRunState, nightNumber: number): CampaignNight | null {
  const def = levelById(camp.levelId);
  if (!def || def.nights.length === 0) return null;
  const idx = Math.max(0, nightNumber - camp.startNight);
  return def.nights[Math.min(idx, def.nights.length - 1)];
}

// --- Scoring ------------------------------------------------------------------------

export function starsForNights(def: CampaignLevelDef, nightsTaken: number): 1 | 2 | 3 {
  if (nightsTaken <= def.parNights) return 3;
  if (nightsTaken <= def.parNights + 1) return 2;
  return 1;
}

// --- Availability helpers (read the resolved rules off the run state) ----------------

export function campaignAllowsRecipe(state: GameState, recipeId: string): boolean {
  const rules = state.campaign?.rules;
  return !rules || rules.recipes.includes(recipeId);
}

export function campaignAllowsOffer(state: GameState, offerId: string): boolean {
  const rules = state.campaign?.rules;
  return !rules || rules.shop.includes(offerId);
}

export function campaignShopClosed(state: GameState): boolean {
  const rules = state.campaign?.rules;
  return !!rules && rules.shop.length === 0;
}

export function campaignAllowsCaves(state: GameState): boolean {
  const rules = state.campaign?.rules;
  return !rules || rules.caves;
}
