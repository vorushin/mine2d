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
  Lava,
  Torch,
  SupplyCrate,
  TurretBasic,
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
  Bridge,
  WallReinforced,
  TurretFlame,
  SpikeTrap,
  // The Deep Dark (appended — tile type ids persist in saves)
  CaveRock,
  CaveFloor,
  CrystalOre,
  ObsidianOre,
  CaveEntrance,
  LadderUp,
  LadderDown,
  VaultChest,
  ThroneGate,
  WallObsidian,
  Gravestone,
  Crypt,
  Web,
}

export type MaterialId =
  | 'wood' | 'stone' | 'iron' | 'gold'
  | 'arrow' | 'bullet'
  | 'lava'
  | 'bomb' | 'wallReinforced' | 'turretFlame'
  | 'crystal' | 'obsidian' | 'soul';

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

  [TileType.Lava]: { walkable: true, opaque: false, baseHp: 9999, pickaxeTier: 3, damageOnEnterDps: 30, tintColor: C(0xff4d1a) },
  [TileType.Torch]: { walkable: true, opaque: false, baseHp: 2, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 0, tintColor: C(0xffd27a) },
  [TileType.SupplyCrate]: { walkable: false, opaque: true, baseHp: 15, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x6b4423) },
  [TileType.TurretBasic]: { walkable: false, opaque: true, baseHp: 40, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0x4d7fff) },

  [TileType.ShopNPC]: { walkable: false, opaque: true, baseHp: 99999, pickaxeTier: 3, tintColor: C(0xffcc00) },

  [TileType.Water]: { walkable: false, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x3e6db0) },
  [TileType.Sand]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0xe0cf8a) },
  [TileType.DeadTree]: { walkable: false, opaque: true, baseHp: 4, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x6b4423) },
  [TileType.Campfire]: { walkable: false, opaque: true, baseHp: 6, pickaxeTier: 0, tintColor: C(0xff8030) },
  [TileType.Cake]: { walkable: false, opaque: true, baseHp: 1, pickaxeTier: 0, tintColor: C(0xffc0cb) },
  [TileType.FlowerField]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0xffb0d8) },
  [TileType.Mushroom]: { walkable: false, opaque: true, baseHp: 2, pickaxeTier: 0, tintColor: C(0xd04040) },
  [TileType.Pumpkin]: { walkable: false, opaque: true, baseHp: 3, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0xff8c00) },
  [TileType.Volcano]: { walkable: false, opaque: true, baseHp: 300, pickaxeTier: 2, dropMaterial: 'gold', dropCount: 8, tintColor: C(0xb01a00) },
  [TileType.Crater]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x3a2410) },
  [TileType.Bridge]: { walkable: true, opaque: false, baseHp: 8, pickaxeTier: 0, dropMaterial: 'wood', dropCount: 1, tintColor: C(0x9c6a3f) },

  [TileType.WallReinforced]: { walkable: false, opaque: true, baseHp: 320, pickaxeTier: 2, dropMaterial: 'iron', dropCount: 1, tintColor: C(0x5a5a70) },
  [TileType.TurretFlame]: { walkable: false, opaque: true, baseHp: 50, pickaxeTier: 1, dropMaterial: 'iron', dropCount: 1, tintColor: C(0xff8030) },
  [TileType.SpikeTrap]: { walkable: true, opaque: false, baseHp: 22, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0xc7ccd4) },

  [TileType.CaveRock]: { walkable: false, opaque: true, baseHp: 14, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0x4a4a58) },
  [TileType.CaveFloor]: { walkable: true, opaque: false, baseHp: 0, pickaxeTier: 0, tintColor: C(0x2e2e3a) },
  [TileType.CrystalOre]: { walkable: false, opaque: true, baseHp: 26, pickaxeTier: 2, dropMaterial: 'crystal', dropCount: 1, tintColor: C(0x7fe7ff) },
  [TileType.ObsidianOre]: { walkable: false, opaque: true, baseHp: 40, pickaxeTier: 3, dropMaterial: 'obsidian', dropCount: 1, tintColor: C(0x2c2440) },
  [TileType.CaveEntrance]: { walkable: true, opaque: false, baseHp: 99999, pickaxeTier: 3, tintColor: C(0x14141e) },
  [TileType.LadderUp]: { walkable: true, opaque: false, baseHp: 99999, pickaxeTier: 3, tintColor: C(0x8a6a3a) },
  [TileType.LadderDown]: { walkable: true, opaque: false, baseHp: 99999, pickaxeTier: 3, tintColor: C(0x3a2a18) },
  [TileType.VaultChest]: { walkable: false, opaque: true, baseHp: 10, pickaxeTier: 0, tintColor: C(0xd9a44a) },
  [TileType.ThroneGate]: { walkable: false, opaque: true, baseHp: 99999, pickaxeTier: 3, tintColor: C(0x6a2a8a) },
  [TileType.WallObsidian]: { walkable: false, opaque: true, baseHp: 460, pickaxeTier: 3, dropMaterial: 'obsidian', dropCount: 1, tintColor: C(0x3a3050) },
  [TileType.Gravestone]: { walkable: false, opaque: true, baseHp: 20, pickaxeTier: 0, dropMaterial: 'stone', dropCount: 1, tintColor: C(0x9a9aa8) },
  [TileType.Crypt]: { walkable: false, opaque: true, baseHp: 260, pickaxeTier: 0, tintColor: C(0x555568) },
  [TileType.Web]: { walkable: true, opaque: false, baseHp: 1, pickaxeTier: 0, tintColor: C(0xe8e8f8) },
};

export function isPlaceableGround(type: TileType): boolean {
  return (
    type === TileType.Grass ||
    type === TileType.Dirt ||
    type === TileType.Sand ||
    type === TileType.FlowerField ||
    type === TileType.CaveFloor
  );
}

export function isBreakable(type: TileType): boolean {
  return (
    type !== TileType.Grass &&
    type !== TileType.Dirt &&
    type !== TileType.Sand &&
    type !== TileType.FlowerField &&
    type !== TileType.Water &&
    type !== TileType.ShopNPC &&
    type !== TileType.CaveFloor &&
    type !== TileType.CaveEntrance &&
    type !== TileType.LadderUp &&
    type !== TileType.LadderDown &&
    type !== TileType.ThroneGate &&
    type !== TileType.Crater
  );
}
