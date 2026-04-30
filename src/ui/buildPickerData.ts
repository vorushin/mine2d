import { HOTBAR, hotbarAvailable, HotbarAction } from './hotbarDef';
import { GameState } from '../state/GameState';

function findIndex(label: string): number {
  const i = HOTBAR.findIndex((a) => a.label === label);
  if (i < 0) throw new Error(`HOTBAR is missing required entry: ${label}`);
  return i;
}

export const BUILD_PICKER_SLOTS: readonly number[] = [
  findIndex('Wall W'),
  findIndex('Wall S'),
  findIndex('Wall I'),
  findIndex('Wall R'),
  findIndex('Door'),
  findIndex('Torch'),
  findIndex('Bridge'),
  findIndex('Lava'),
  findIndex('Turret'),
  findIndex('T Flame'),
];

export interface BuildPickerCell {
  hotbarIndex: number;
  label: string;
  costLabel: string;
  color: number;
  available: boolean;
  action: HotbarAction;
}

function materialShortName(material: string): string {
  switch (material) {
    case 'wood': return 'W';
    case 'stone': return 'S';
    case 'iron': return 'I';
    case 'lava': return 'Lava';
    case 'wallReinforced': return 'R-Wall';
    case 'turretFlame': return 'F-Turret';
    default: return material;
  }
}

function costLabelFor(action: HotbarAction): string {
  if (action.kind !== 'place') return '';
  return action.cost.map((c) => `${c.count}${materialShortName(c.material)}`).join(' ');
}

export function buildPickerCells(state: GameState): BuildPickerCell[] {
  return BUILD_PICKER_SLOTS.map((idx) => {
    const act = HOTBAR[idx];
    return {
      hotbarIndex: idx,
      label: act.label,
      costLabel: costLabelFor(act),
      color: act.color,
      available: hotbarAvailable(idx, state),
      action: act,
    };
  });
}
