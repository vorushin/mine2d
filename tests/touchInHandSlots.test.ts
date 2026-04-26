import { describe, it, expect } from 'vitest';
import { TOUCH_INHAND_SLOTS, touchSlotToHotbarIndex } from '../src/ui/touchInHandSlots';
import { HOTBAR } from '../src/ui/hotbarDef';

describe('TOUCH_INHAND_SLOTS', () => {
  it('exposes exactly 6 in-hand tools', () => {
    expect(TOUCH_INHAND_SLOTS).toHaveLength(6);
  });

  it('maps slot 0 to Pickaxe (mine)', () => {
    const idx = touchSlotToHotbarIndex(0);
    expect(HOTBAR[idx].kind).toBe('mine');
  });

  it('maps slot 1 to Sword (melee)', () => {
    const idx = touchSlotToHotbarIndex(1);
    expect(HOTBAR[idx].kind).toBe('melee');
    expect(HOTBAR[idx].label).toBe('Sword');
  });

  it('covers Bow, Pistol, Bomb, Hammer in slots 2-5', () => {
    expect(HOTBAR[touchSlotToHotbarIndex(2)].label).toBe('Bow');
    expect(HOTBAR[touchSlotToHotbarIndex(3)].label).toBe('Pistol');
    expect(HOTBAR[touchSlotToHotbarIndex(4)].label).toBe('Bomb');
    expect(HOTBAR[touchSlotToHotbarIndex(5)].label).toBe('Hammer');
  });

  it('returns -1 for out-of-range slots', () => {
    expect(touchSlotToHotbarIndex(-1)).toBe(-1);
    expect(touchSlotToHotbarIndex(6)).toBe(-1);
  });

  it('only exposes non-place HOTBAR kinds', () => {
    for (const idx of TOUCH_INHAND_SLOTS) {
      expect(HOTBAR[idx].kind).not.toBe('place');
    }
  });
});
