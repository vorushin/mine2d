import { MaterialId } from '../world/tileTypes';

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

export interface GameState {
  nightNumber: number;
  score: number;
  phase: 'day' | 'dusk' | 'night' | 'dawn';
  phaseElapsedMs: number;
  playerHp: number;
  playerMaxHp: number;
  inventory: Inventory;
  pickaxeTier: 0 | 1 | 2;
  swordTier: 0 | 1;
  hasBow: boolean;
  hasPistol: boolean;
  hotbarSlot: number;
  running: boolean;
  stats: RunStats;
}

export function makeGameState(): GameState {
  return {
    nightNumber: 1,
    score: 0,
    phase: 'day',
    phaseElapsedMs: 0,
    playerHp: 100,
    playerMaxHp: 100,
    inventory: makeInventory(),
    pickaxeTier: 0,
    swordTier: 0,
    hasBow: false,
    hasPistol: false,
    hotbarSlot: 0,
    running: true,
    stats: { zombiesKilled: 0, tilesMined: 0, tilesPlaced: 0, goldEarned: 0 },
  };
}
