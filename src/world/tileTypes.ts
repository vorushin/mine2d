export const enum TileType {
  Grass = 0,
  Dirt,
  Tree,
  Stone,
  IronOre,
  GoldOre,
  WallWood,
  WallStone,
  WallIron,
  DoorWood,
  DoorIron,
  Lava,
  Torch,
  CraftingBench,
  Chest,
  TurretBasic,
  TurretAdvanced,
  ShopNPC,
  Water,
  Sand,
  DeadTree,
  Campfire,
  Cake,
  FlowerField,
  Mushroom,
  Pumpkin,
  Volcano,
  Crater,
}

export type MaterialId = 'wood' | 'stone' | 'iron' | 'gold' | 'arrow' | 'bullet' | 'lava' | 'potion' | 'food';

export type ToolTier = 0 | 1 | 2 | 3;

export interface TileSpec {
  walkable: boolean;
  opaque: boolean;
  baseHp: number;
  pickaxeTier: ToolTier;
  dropMaterial?: MaterialId;
  dropCount?: number;
  damageOnEnterDps?: number;
  tintColor: number;
}

const C = (hex: number) => hex;

export const TILE_SPECS: Record<TileType, TileSpec> = {
  [TileType.Grass]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x5bbd5b) },
  [TileType.Dirt]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x7a4a2b) },
  [TileType.Tree]: { walkable: false, opaque: true, baseHp: 8, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 2, tintColor: C(0x2e7d32) },
  [TileType.Stone]: { walkable: false, opaque: true, baseHp: 12, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0x888888) },
  [TileType.IronOre]: { walkable: false, opaque: true, baseHp: 18, pickaxeTier: 1, dropMaterial: 'iron', dropCount: 1, tintColor: C(0xc9b037) },
  [TileType.GoldOre]: { walkable: false, opaque: true, baseHp: 24, pickaxeTier: 2, dropMaterial: 'gold', dropCount: 1, tintColor: C(0xffd700) },

  [TileType.WallWood]: { walkable: false, opaque: true, baseHp: 30, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x9c6a3f) },
  [TileType.WallStone]: { walkable: false, opaque: true, baseHp: 80, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0x707070) },
  [TileType.WallIron]: { walkable: false, opaque: true, baseHp: 200, pickaxeTier: 1, dropMaterial: 'iron', dropCount: 1, tintColor: C(0xb0b0c0) },
  [TileType.DoorWood]: { walkable: true, opaque: true, baseHp: 25, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x5e3a1b) },
  [TileType.DoorIron]: { walkable: true, opaque: true, baseHp: 120, pickaxeTier: 1, dropMaterial: 'iron', dropCount: 1, tintColor: C(0x8a8aa0) },

  [TileType.Lava]: { walkable: true, opaque: false, baseHp: 9999, pickaxeTier: 3, damageOnEnterDps: 30, tintColor: C(0xff4d1a) },
  [TileType.Torch]: { walkable: true, opaque: false, baseHp: 2, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 0, tintColor: C(0xffd27a) },
  [TileType.CraftingBench]: { walkable: false, opaque: true, baseHp: 20, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 2, tintColor: C(0xb5651d) },
  [TileType.Chest]: { walkable: false, opaque: true, baseHp: 15, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x6b4423) },
  [TileType.TurretBasic]: { walkable: false, opaque: true, baseHp: 40, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0x4d7fff) },
  [TileType.TurretAdvanced]: { walkable: false, opaque: true, baseHp: 60, pickaxeTier: 1, dropMaterial: 'iron', dropCount: 1, tintColor: C(0x8040ff) },

  [TileType.ShopNPC]: { walkable: false, opaque: true, baseHp: 99999, pickaxeTier: 3, tintColor: C(0xffcc00) },

  [TileType.Water]: { walkable: false, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x3e6db0) },
  [TileType.Sand]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0xe0cf8a) },
  [TileType.DeadTree]: { walkable: false, opaque: true, baseHp: 4, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x6b4423) },
  [TileType.Campfire]: { walkable: false, opaque: true, baseHp: 6, pickaxeTier: 0, tintColor: C(0xff8030) },
  [TileType.Cake]: { walkable: false, opaque: true, baseHp: 1, pickaxeTier: 0, tintColor: C(0xffc0cb) },
  [TileType.FlowerField]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0xffb0d8) },
  [TileType.Mushroom]: { walkable: false, opaque: true, baseHp: 2, pickaxeTier: 0, dropMaterial: 'potion', dropCount: 1, tintColor: C(0xd04040) },
  [TileType.Pumpkin]: { walkable: false, opaque: true, baseHp: 3, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0xff8c00) },
  [TileType.Volcano]: { walkable: false, opaque: true, baseHp: 300, pickaxeTier: 2, dropMaterial: 'gold', dropCount: 8, tintColor: C(0xb01a00) },
  [TileType.Crater]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x3a2410) },
};

export function isPlaceableGround(type: TileType): boolean {
  return type === TileType.Grass || type === TileType.Dirt || type === TileType.Sand || type === TileType.FlowerField;
}

export function isBreakable(type: TileType): boolean {
  return (
    type !== TileType.Grass &&
    type !== TileType.Dirt &&
    type !== TileType.Sand &&
    type !== TileType.FlowerField &&
    type !== TileType.Water &&
    type !== TileType.ShopNPC
  );
}
