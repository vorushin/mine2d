import { HOTBAR } from './hotbarDef';

function findIndex(label: string): number {
  const i = HOTBAR.findIndex((a) => a.label === label);
  if (i < 0) throw new Error(`HOTBAR is missing required entry: ${label}`);
  return i;
}

export const TOUCH_INHAND_SLOTS: readonly number[] = [
  findIndex('Pick'),
  findIndex('Sword'),
  findIndex('Bow'),
  findIndex('Pistol'),
  findIndex('Bomb'),
  findIndex('Hammer'),
];

export function touchSlotToHotbarIndex(touchSlot: number): number {
  if (touchSlot < 0 || touchSlot >= TOUCH_INHAND_SLOTS.length) return -1;
  return TOUCH_INHAND_SLOTS[touchSlot];
}
