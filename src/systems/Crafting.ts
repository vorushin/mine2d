import { MaterialId } from '../world/tileTypes';
import { GameState, addItem, hasItem, removeItem } from '../state/GameState';

export type CraftResultKind = 'material' | 'tool_upgrade' | 'weapon';

export interface Recipe {
  id: string;
  label: string;
  inputs: { material: MaterialId; count: number }[];
  produces: CraftAction;
  requiresBench: boolean;
}

export type CraftAction =
  | { kind: 'material'; material: MaterialId; count: number }
  | { kind: 'pickaxe_upgrade'; toTier: 1 | 2 }
  | { kind: 'sword_upgrade'; toTier: 1 }
  | { kind: 'unlock_bow' }
  | { kind: 'unlock_pistol' }
  | { kind: 'unlock_hammer' };

export const RECIPES: Recipe[] = [
  {
    id: 'stone_pickaxe',
    label: 'Stone Pickaxe',
    inputs: [{ material: 'wood', count: 2 }, { material: 'stone', count: 3 }],
    produces: { kind: 'pickaxe_upgrade', toTier: 1 },
    requiresBench: false,
  },
  {
    id: 'iron_pickaxe',
    label: 'Iron Pickaxe',
    inputs: [{ material: 'wood', count: 2 }, { material: 'iron', count: 4 }],
    produces: { kind: 'pickaxe_upgrade', toTier: 2 },
    requiresBench: false,
  },
  {
    id: 'iron_sword',
    label: 'Iron Sword',
    inputs: [{ material: 'wood', count: 1 }, { material: 'iron', count: 3 }],
    produces: { kind: 'sword_upgrade', toTier: 1 },
    requiresBench: false,
  },
  {
    id: 'bow',
    label: 'Bow',
    inputs: [{ material: 'wood', count: 4 }, { material: 'iron', count: 1 }],
    produces: { kind: 'unlock_bow' },
    requiresBench: false,
  },
  {
    id: 'arrows_x5',
    label: '5 Arrows',
    inputs: [{ material: 'wood', count: 3 }],
    produces: { kind: 'material', material: 'arrow', count: 5 },
    requiresBench: false,
  },
  {
    id: 'arrows_x20',
    label: '20 Arrows',
    inputs: [{ material: 'wood', count: 10 }],
    produces: { kind: 'material', material: 'arrow', count: 20 },
    requiresBench: false,
  },
  {
    id: 'reinforced_wall_x4',
    label: 'Reinforced Wall ×4',
    inputs: [{ material: 'iron', count: 2 }, { material: 'stone', count: 3 }],
    produces: { kind: 'material', material: 'wallReinforced', count: 4 },
    requiresBench: false,
  },
  {
    id: 'repair_hammer',
    label: 'Repair Hammer',
    inputs: [{ material: 'wood', count: 2 }, { material: 'iron', count: 1 }],
    produces: { kind: 'unlock_hammer' },
    requiresBench: false,
  },
  {
    id: 'flame_turret',
    label: 'Flame Turret',
    inputs: [{ material: 'wood', count: 6 }, { material: 'stone', count: 4 }, { material: 'iron', count: 4 }],
    produces: { kind: 'material', material: 'turretFlame', count: 1 },
    requiresBench: false,
  },
  {
    id: 'bomb_x3',
    label: '3 Bombs',
    inputs: [{ material: 'wood', count: 3 }, { material: 'iron', count: 2 }],
    produces: { kind: 'material', material: 'bomb', count: 3 },
    requiresBench: false,
  },
];

export type CraftOutcome = { ok: true } | { ok: false; reason: 'missing_materials' | 'no_bench' | 'already_have' };

export function canCraft(recipe: Recipe, state: GameState, benchAvailable: boolean): CraftOutcome {
  if (recipe.requiresBench && !benchAvailable) return { ok: false, reason: 'no_bench' };
  for (const inp of recipe.inputs) {
    if (!hasItem(state.inventory, inp.material, inp.count)) return { ok: false, reason: 'missing_materials' };
  }
  const a = recipe.produces;
  if (a.kind === 'pickaxe_upgrade' && state.pickaxeTier >= a.toTier) return { ok: false, reason: 'already_have' };
  if (a.kind === 'sword_upgrade' && state.swordTier >= a.toTier) return { ok: false, reason: 'already_have' };
  if (a.kind === 'unlock_bow' && state.hasBow) return { ok: false, reason: 'already_have' };
  if (a.kind === 'unlock_pistol' && state.hasPistol) return { ok: false, reason: 'already_have' };
  if (a.kind === 'unlock_hammer' && state.hasHammer) return { ok: false, reason: 'already_have' };
  return { ok: true };
}

export function applyCraft(recipe: Recipe, state: GameState, benchAvailable: boolean): CraftOutcome {
  const check = canCraft(recipe, state, benchAvailable);
  if (!check.ok) return check;
  for (const inp of recipe.inputs) removeItem(state.inventory, inp.material, inp.count);
  const a = recipe.produces;
  switch (a.kind) {
    case 'material':
      addItem(state.inventory, a.material, a.count);
      break;
    case 'pickaxe_upgrade':
      state.pickaxeTier = a.toTier;
      break;
    case 'sword_upgrade':
      state.swordTier = a.toTier;
      break;
    case 'unlock_bow':
      state.hasBow = true;
      break;
    case 'unlock_pistol':
      state.hasPistol = true;
      break;
    case 'unlock_hammer':
      state.hasHammer = true;
      break;
  }
  return { ok: true };
}
