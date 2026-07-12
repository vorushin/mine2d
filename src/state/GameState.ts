import { MaterialId } from '../world/tileTypes';
import { ClassId, CompanionId, ModifierId } from '../systems/MetaStore';
import type { CampaignRunState } from '../systems/Campaign';

export interface Inventory {
  counts: Partial<Record<MaterialId, number>>;
}

export function makeInventory(): Inventory {
  return { counts: {} };
}

export function addItem(inv: Inventory, id: MaterialId, count: number): void {
  inv.counts[id] = (inv.counts[id] ?? 0) + count;
}

export function hasItem(inv: Inventory, id: MaterialId, count: number): boolean {
  return (inv.counts[id] ?? 0) >= count;
}

export function removeItem(inv: Inventory, id: MaterialId, count: number): boolean {
  if (!hasItem(inv, id, count)) return false;
  inv.counts[id] = (inv.counts[id] ?? 0) - count;
  if ((inv.counts[id] ?? 0) <= 0) delete inv.counts[id];
  return true;
}

export type HotbarItem =
  | { kind: 'tool'; id: 'pickaxe' | 'sword' }
  | { kind: 'ranged'; id: 'bow' | 'pistol' }
  | { kind: 'place'; tileType: number; label: string; cost: { material: MaterialId; count: number } };

export interface RunStats {
  zombiesKilled: number;
  tilesMined: number;
  tilesPlaced: number;
  goldEarned: number;
}

export type DailyQuestKind = 'mine' | 'build' | 'kill';

export interface DailyQuest {
  id: string;
  day: number;
  title: string;
  hint: string;
  kind: DailyQuestKind;
  progress: number;
  goal: number;
  reward: { material: MaterialId; count: number }[];
  completed: boolean;
}

export type PowerUpKind = 'haste' | 'fury' | 'shield';

export interface ActiveBuffs {
  hasteMs: number;
  furyMs: number;
  shieldMs: number;
}

export interface RunMeta {
  bossKills: number;
  maxDepth: number;
  graveyardsCleared: number;
  /** Star Coins already banked for this run (guards double-award). */
  coinsAwarded: boolean;
}

export interface GameState {
  nightNumber: number;
  score: number;
  phase: 'day' | 'dusk' | 'night' | 'dawn';
  phaseElapsedMs: number;
  /** 0 = surface, 1-3 = cave floors of the Deep Dark. */
  depth: 0 | 1 | 2 | 3;
  playerHp: number;
  playerMaxHp: number;
  inventory: Inventory;
  pickaxeTier: 0 | 1 | 2 | 3;
  swordTier: 0 | 1 | 2;
  hasBow: boolean;
  hasPistol: boolean;
  hasHammer: boolean;
  hasFreezeWand: boolean;
  hasStormWand: boolean;
  hasRod: boolean;
  hasCrystalKey: boolean;
  /** The Zombie King has fallen — the run is won (Endless+ may continue). */
  victory: boolean;
  endlessPlus: boolean;
  classId: ClassId;
  buddyId: CompanionId | null;
  modifierId: ModifierId | null;
  hotbarSlot: number;
  running: boolean;
  stats: RunStats;
  runMeta: RunMeta;
  dailyQuest: DailyQuest | null;
  activeBuffs: ActiveBuffs;
  heroCharge: number;
  /** Active campaign level (null on classic runs). Campaign runs never save. */
  campaign: CampaignRunState | null;
}

export function makeGameState(): GameState {
  return {
    nightNumber: 1,
    score: 0,
    phase: 'day',
    phaseElapsedMs: 0,
    depth: 0,
    playerHp: 100,
    playerMaxHp: 100,
    inventory: makeInventory(),
    pickaxeTier: 0,
    swordTier: 0,
    hasBow: false,
    hasPistol: false,
    hasHammer: false,
    hasFreezeWand: false,
    hasStormWand: false,
    hasRod: false,
    hasCrystalKey: false,
    victory: false,
    endlessPlus: false,
    classId: 'adventurer',
    buddyId: null,
    modifierId: null,
    hotbarSlot: 0,
    running: true,
    stats: { zombiesKilled: 0, tilesMined: 0, tilesPlaced: 0, goldEarned: 0 },
    runMeta: { bossKills: 0, maxDepth: 0, graveyardsCleared: 0, coinsAwarded: false },
    dailyQuest: null,
    activeBuffs: { hasteMs: 0, furyMs: 0, shieldMs: 0 },
    heroCharge: 0,
    campaign: null,
  };
}
