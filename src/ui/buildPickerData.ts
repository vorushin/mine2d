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
  findIndex('Bench'),
];

export interface BuildPickerCell {
  hotbarIndex: number;
  label: string;
  color: number;
  available: boolean;
  action: HotbarAction;
}

export function buildPickerCells(state: GameState): BuildPickerCell[] {
  return BUILD_PICKER_SLOTS.map((idx) => {
    const act = HOTBAR[idx];
    return {
      hotbarIndex: idx,
      label: act.label,
      color: act.color,
      available: hotbarAvailable(idx, state),
      action: act,
    };
  });
}
