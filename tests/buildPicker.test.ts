import { describe, it, expect } from 'vitest';
import { BUILD_PICKER_SLOTS, buildPickerCells } from '../src/ui/buildPickerData';
import { HOTBAR } from '../src/ui/hotbarDef';
import { makeGameState, addItem } from '../src/state/GameState';

describe('BUILD_PICKER_SLOTS', () => {
  it('contains 11 placement actions', () => {
    expect(BUILD_PICKER_SLOTS).toHaveLength(11);
  });

  it('only references HOTBAR entries with kind "place"', () => {
    for (const idx of BUILD_PICKER_SLOTS) {
      expect(HOTBAR[idx].kind).toBe('place');
    }
  });

  it('starts with the four wall tiers (W, S, I, R)', () => {
    expect(HOTBAR[BUILD_PICKER_SLOTS[0]].label).toBe('Wall W');
    expect(HOTBAR[BUILD_PICKER_SLOTS[1]].label).toBe('Wall S');
    expect(HOTBAR[BUILD_PICKER_SLOTS[2]].label).toBe('Wall I');
    expect(HOTBAR[BUILD_PICKER_SLOTS[3]].label).toBe('Wall R');
  });
});

describe('buildPickerCells', () => {
  it('marks cells unavailable when the player lacks materials', () => {
    const state = makeGameState();
    const cells = buildPickerCells(state);
    expect(cells).toHaveLength(11);
    const stoneWall = cells.find((c) => c.label === 'Wall S');
    expect(stoneWall?.available).toBe(false);
  });

  it('marks cells available when materials are present', () => {
    const state = makeGameState();
    addItem(state.inventory, 'wood', 10);
    addItem(state.inventory, 'stone', 10);
    const cells = buildPickerCells(state);
    expect(cells.find((c) => c.label === 'Wall W')?.available).toBe(true);
    expect(cells.find((c) => c.label === 'Wall S')?.available).toBe(true);
    expect(cells.find((c) => c.label === 'Wall I')?.available).toBe(false);
  });

  it('preserves slot ordering across availability changes', () => {
    const state = makeGameState();
    addItem(state.inventory, 'wood', 1);
    const cells = buildPickerCells(state);
    expect(cells.map((c) => c.label)[0]).toBe('Wall W');
    expect(cells.map((c) => c.label)[10]).toBe('Bench');
  });
});
