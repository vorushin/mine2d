import { GameState, addItem } from '../state/GameState';
import { MaterialId } from '../world/tileTypes';
import { ClassId } from './MetaStore';

/**
 * Hero classes — chosen at run start, unlocked in the Hero's Hut. Each is a
 * starting kit plus one small passive; Adventurer is the free default.
 */

export interface ClassSpec {
  id: ClassId;
  name: string;
  icon: string;
  blurb: string;
  kit: { material: MaterialId; count: number }[];
  meleeBonus?: number;
  bowBonus?: number;
  mineMult?: number;
  startPickaxeTier?: 1;
  startSwordTier?: 1;
  startBow?: boolean;
  startHammer?: boolean;
}

export const CLASS_SPECS: Record<ClassId, ClassSpec> = {
  adventurer: {
    id: 'adventurer', name: 'Adventurer', icon: '🎒',
    blurb: 'The classic start. A little wood, a little stone, a big heart.',
    kit: [],
  },
  knight: {
    id: 'knight', name: 'Knight', icon: '⚔️',
    blurb: 'Starts with an iron sword and hits harder in melee.',
    kit: [{ material: 'iron', count: 2 }],
    startSwordTier: 1,
    meleeBonus: 6,
  },
  ranger: {
    id: 'ranger', name: 'Ranger', icon: '🏹',
    blurb: 'Starts with a bow and 20 arrows. Arrows fly harder.',
    kit: [{ material: 'arrow', count: 20 }],
    startBow: true,
    bowBonus: 6,
  },
  engineer: {
    id: 'engineer', name: 'Engineer', icon: '🔧',
    blurb: 'Starts with the repair hammer and a full turret kit.',
    kit: [{ material: 'wood', count: 5 }, { material: 'stone', count: 5 }, { material: 'iron', count: 3 }],
    startHammer: true,
  },
  miner: {
    id: 'miner', name: 'Miner', icon: '⛏️',
    blurb: 'Starts with a stone pickaxe and mines twice as fast.',
    kit: [{ material: 'stone', count: 4 }],
    startPickaxeTier: 1,
    mineMult: 2,
  },
};

/** Apply a class's starting kit + unlocks to a fresh run state. */
export function applyClassStart(state: GameState, id: ClassId): void {
  const spec = CLASS_SPECS[id];
  state.classId = id;
  for (const item of spec.kit) addItem(state.inventory, item.material, item.count);
  if (spec.startPickaxeTier) state.pickaxeTier = Math.max(state.pickaxeTier, spec.startPickaxeTier) as GameState['pickaxeTier'];
  if (spec.startSwordTier) state.swordTier = Math.max(state.swordTier, spec.startSwordTier) as GameState['swordTier'];
  if (spec.startBow) state.hasBow = true;
  if (spec.startHammer) state.hasHammer = true;
}

export function classMeleeBonus(state: GameState): number {
  return CLASS_SPECS[state.classId]?.meleeBonus ?? 0;
}

export function classBowBonus(state: GameState): number {
  return CLASS_SPECS[state.classId]?.bowBonus ?? 0;
}

export function classMineMult(state: GameState): number {
  return CLASS_SPECS[state.classId]?.mineMult ?? 1;
}
