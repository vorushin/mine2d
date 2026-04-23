import { TileType } from '../world/tileTypes';
import { GameState, hasItem } from '../state/GameState';

export type HotbarAction =
  | { kind: 'mine'; label: string; name: string; description: string; color: number; requires?: 'pickaxe' }
  | { kind: 'melee'; label: string; name: string; description: string; color: number }
  | { kind: 'ranged'; label: string; name: string; description: string; color: number; ammo: 'arrow' | 'bullet'; weapon: 'bow' | 'pistol' }
  | { kind: 'hammer'; label: string; name: string; description: string; color: number }
  | { kind: 'throw'; label: string; name: string; description: string; color: number; ammo: 'bomb' }
  | {
      kind: 'place';
      label: string;
      name: string;
      description: string;
      color: number;
      tile: TileType;
      cost: { material: 'wood' | 'stone' | 'iron' | 'lava' | 'wallReinforced' | 'turretFlame'; count: number }[];
      onto?: 'ground' | 'water';
    };

export const HOTBAR: HotbarAction[] = [
  {
    kind: 'mine',
    label: 'Pick',
    name: 'Pickaxe',
    description: 'Breaks trees, stone, and ore. Upgrade via crafting: stone pickaxe mines iron, iron pickaxe mines gold.',
    color: 0x8a8a8a,
    requires: 'pickaxe',
  },
  {
    kind: 'melee',
    label: 'Sword',
    name: 'Sword',
    description: 'Click near a zombie to swing. Craft an iron sword for more damage.',
    color: 0xc4b6a6,
  },
  {
    kind: 'ranged',
    label: 'Bow',
    name: 'Bow',
    description: 'Ranged weapon. Craft one at a bench first. Each shot consumes 1 arrow.',
    color: 0x8b5a2b,
    ammo: 'arrow',
    weapon: 'bow',
  },
  {
    kind: 'ranged',
    label: 'Pistol',
    name: 'Pistol',
    description: 'High-damage sidearm. Buy it from the shop. Each shot consumes 1 bullet.',
    color: 0x404048,
    ammo: 'bullet',
    weapon: 'pistol',
  },
  {
    kind: 'place',
    label: 'Wall W',
    name: 'Wooden Wall',
    description: 'Blocks zombies. Weakest wall. Cost: 2 wood.',
    color: 0x9c6a3f,
    tile: TileType.WallWood,
    cost: [{ material: 'wood', count: 2 }],
  },
  {
    kind: 'place',
    label: 'Wall S',
    name: 'Stone Wall',
    description: 'Much tougher than wood. Cost: 3 stone.',
    color: 0x707070,
    tile: TileType.WallStone,
    cost: [{ material: 'stone', count: 3 }],
  },
  {
    kind: 'place',
    label: 'Wall I',
    name: 'Iron Wall',
    description: 'Strongest wall. Needs an iron pickaxe to remove. Cost: 4 iron.',
    color: 0xb0b0c0,
    tile: TileType.WallIron,
    cost: [{ material: 'iron', count: 4 }],
  },
  {
    kind: 'place',
    label: 'Door',
    name: 'Wooden Door',
    description: 'You walk through it, zombies have to break it. Press E to open/close. Cost: 2 wood.',
    color: 0x5e3a1b,
    tile: TileType.DoorWood,
    cost: [{ material: 'wood', count: 2 }],
  },
  {
    kind: 'place',
    label: 'Torch',
    name: 'Torch',
    description: 'Light source for dark corners of your base. Cost: 1 wood.',
    color: 0xffd27a,
    tile: TileType.Torch,
    cost: [{ material: 'wood', count: 1 }],
  },
  {
    kind: 'place',
    label: 'Turret',
    name: 'Arrow Turret',
    description: 'Auto-fires arrows at zombies in range. Endless ammo. Cost: 5 wood + 5 stone + 3 iron.',
    color: 0x4d7fff,
    tile: TileType.TurretBasic,
    cost: [{ material: 'wood', count: 5 }, { material: 'stone', count: 5 }, { material: 'iron', count: 3 }],
  },
  {
    kind: 'place',
    label: 'Bench',
    name: 'Crafting Bench',
    description: 'Stand next to it and press E to open the crafting menu. Required for tool and weapon upgrades. Cost: 4 wood.',
    color: 0xb5651d,
    tile: TileType.CraftingBench,
    cost: [{ material: 'wood', count: 4 }],
  },
  {
    kind: 'place',
    label: 'Lava',
    name: 'Lava',
    description: 'Damages anything standing on it — including you. Great as a moat. Buy from shop.',
    color: 0xff4d1a,
    tile: TileType.Lava,
    cost: [{ material: 'lava', count: 1 }],
  },
  {
    kind: 'place',
    label: 'Bridge',
    name: 'Wooden Bridge',
    description: 'Place over water to walk across the lake. Cost: 2 wood. Can be mined back.',
    color: 0x9c6a3f,
    tile: TileType.Bridge,
    cost: [{ material: 'wood', count: 2 }],
    onto: 'water',
  },
  {
    kind: 'place',
    label: 'Wall R',
    name: 'Reinforced Wall',
    description: 'Highest-HP wall. Craft 4 at a bench: 2 iron + 3 stone. Consumes a placement token.',
    color: 0x5a5a70,
    tile: TileType.WallReinforced,
    cost: [{ material: 'wallReinforced', count: 1 }],
  },
  {
    kind: 'place',
    label: 'T Flame',
    name: 'Flame Turret',
    description: 'Short-range piercing turret. Craft at a bench first. Consumes a placement token.',
    color: 0xff8030,
    tile: TileType.TurretFlame,
    cost: [{ material: 'turretFlame', count: 1 }],
  },
  {
    kind: 'hammer',
    label: 'Hammer',
    name: 'Repair Hammer',
    description: 'Click a damaged structure to restore it to full HP. Costs 1 unit of the tile’s own material.',
    color: 0xc0c0d0,
  },
  {
    kind: 'throw',
    label: 'Bomb',
    name: 'Bomb',
    description: 'Click to throw toward cursor; explodes after a short fuse. Big AoE damage.',
    color: 0x2a2a2a,
    ammo: 'bomb',
  },
];

export function hotbarAvailable(slot: number, state: GameState): boolean {
  const act = HOTBAR[slot];
  if (!act) return false;
  switch (act.kind) {
    case 'mine':
      return true;
    case 'melee':
      return true;
    case 'ranged':
      if (act.weapon === 'bow' && !state.hasBow) return false;
      if (act.weapon === 'pistol' && !state.hasPistol) return false;
      return hasItem(state.inventory, act.ammo, 1);
    case 'hammer':
      return state.hasHammer;
    case 'throw':
      return hasItem(state.inventory, act.ammo, 1);
    case 'place':
      return act.cost.every((c) => hasItem(state.inventory, c.material, c.count));
  }
}
