// Pure game rules: blocks, resources, costs, pickaxe tiers.

export type Res = 'wood' | 'stone' | 'iron' | 'gold' | 'crystal';
export const RES_LIST: Res[] = ['wood', 'stone', 'iron', 'gold', 'crystal'];
export type Inventory = Record<Res, number>;
export type Cost = Partial<Inventory>;

export const RES_ICON: Record<Res, string> = {
  wood: '🪵', stone: '🪨', iron: '⛓️', gold: '🪙', crystal: '💎',
};

export function emptyInventory(): Inventory {
  return { wood: 0, stone: 0, iron: 0, gold: 0, crystal: 0 };
}

export enum Ground { Water = 0, Sand = 1, Grass = 2, Dirt = 3 }

export enum B {
  None = 0,
  Tree, Rock, Iron, Gold, Crystal,
  WallWood, WallStone, Torch, Turret, TNT, Chest,
}

export interface BlockDef {
  name: string;
  hp: number;
  /** Blocks movement of player and zombies. */
  solid: boolean;
  /** Minimum pickaxe tier needed to damage it. */
  minTier: number;
  drops: Cost;
  /** Placed by the player (zombies target these when blocked). */
  built: boolean;
}

export const BLOCKS: Record<B, BlockDef> = {
  [B.None]: { name: '', hp: 0, solid: false, minTier: 0, drops: {}, built: false },
  [B.Tree]: { name: 'Tree', hp: 3, solid: true, minTier: 0, drops: { wood: 3 }, built: false },
  [B.Rock]: { name: 'Rock', hp: 4, solid: true, minTier: 0, drops: { stone: 2 }, built: false },
  [B.Iron]: { name: 'Iron ore', hp: 6, solid: true, minTier: 1, drops: { iron: 2, stone: 1 }, built: false },
  [B.Gold]: { name: 'Gold ore', hp: 6, solid: true, minTier: 1, drops: { gold: 2 }, built: false },
  [B.Crystal]: { name: 'Crystal', hp: 9, solid: true, minTier: 2, drops: { crystal: 2 }, built: false },
  [B.WallWood]: { name: 'Wood wall', hp: 45, solid: true, minTier: 0, drops: { wood: 1 }, built: true },
  [B.WallStone]: { name: 'Stone wall', hp: 120, solid: true, minTier: 0, drops: { stone: 1 }, built: true },
  [B.Torch]: { name: 'Torch', hp: 12, solid: false, minTier: 0, drops: {}, built: true },
  [B.Turret]: { name: 'Turret', hp: 70, solid: true, minTier: 0, drops: { iron: 1 }, built: true },
  [B.TNT]: { name: 'TNT', hp: 1, solid: false, minTier: 0, drops: {}, built: true },
  [B.Chest]: { name: 'Treasure', hp: 1, solid: true, minTier: 0, drops: {}, built: false },
};

export interface Tier {
  name: string;
  blockPower: number;
  damage: number;
  color: number;
  cost: Cost;
}

export const PICK_TIERS: Tier[] = [
  { name: 'Wood Pickaxe', blockPower: 1, damage: 5, color: 0x9c6a3f, cost: {} },
  { name: 'Stone Pickaxe', blockPower: 1.8, damage: 8, color: 0x9a9a9a, cost: { wood: 5, stone: 5 } },
  { name: 'Iron Pickaxe', blockPower: 3, damage: 12, color: 0xe8e8f0, cost: { iron: 6, wood: 4 } },
  { name: 'Crystal Pickaxe', blockPower: 5, damage: 20, color: 0x6ff0ff, cost: { crystal: 3, gold: 4 } },
];

export type BuildId = 'wall' | 'torch' | 'turret' | 'tnt';
export const BUILD_IDS: BuildId[] = ['wall', 'torch', 'turret', 'tnt'];

export interface BuildOption {
  id: BuildId;
  block: B;
  cost: Cost;
  label: string;
  icon: string;
}

/** Wall uses stone when you have enough, otherwise wood. */
export function buildOption(id: BuildId, inv: Inventory): BuildOption {
  switch (id) {
    case 'wall':
      return inv.stone >= 2
        ? { id, block: B.WallStone, cost: { stone: 2 }, label: 'Stone Wall', icon: '🧱' }
        : { id, block: B.WallWood, cost: { wood: 2 }, label: 'Wood Wall', icon: '🟫' };
    case 'torch':
      return { id, block: B.Torch, cost: { wood: 1 }, label: 'Torch', icon: '🔥' };
    case 'turret':
      return { id, block: B.Turret, cost: { wood: 3, iron: 2 }, label: 'Turret', icon: '🏹' };
    case 'tnt':
      return { id, block: B.TNT, cost: { gold: 1, stone: 2 }, label: 'TNT', icon: '🧨' };
  }
}

export function canAfford(inv: Inventory, cost: Cost): boolean {
  return RES_LIST.every((r) => inv[r] >= (cost[r] ?? 0));
}

export function pay(inv: Inventory, cost: Cost): boolean {
  if (!canAfford(inv, cost)) return false;
  for (const r of RES_LIST) inv[r] -= cost[r] ?? 0;
  return true;
}

export function add(inv: Inventory, gain: Cost): void {
  for (const r of RES_LIST) inv[r] += gain[r] ?? 0;
}

export function costText(cost: Cost): string {
  return RES_LIST.filter((r) => cost[r]).map((r) => `${cost[r]}${RES_ICON[r]}`).join(' ');
}

/** Number of pickaxe swings to break a block at a tier; Infinity if too weak. */
export function swingsToBreak(block: B, tier: number): number {
  const def = BLOCKS[block];
  if (tier < def.minTier) return Infinity;
  return Math.ceil(def.hp / PICK_TIERS[tier].blockPower);
}
