import { describe, it, expect } from 'vitest';
import { consumeFood, consumePotion } from '../src/systems/Consumables';
import { makeGameState, addItem } from '../src/state/GameState';

describe('consumeFood', () => {
  it('does nothing when there is no food', () => {
    const state = makeGameState();
    state.playerHp = 50;
    expect(consumeFood(state)).toEqual({ ok: false });
    expect(state.playerHp).toBe(50);
  });

  it('heals 20 HP and decrements food count', () => {
    const state = makeGameState();
    state.playerHp = 50;
    addItem(state.inventory, 'food', 2);
    expect(consumeFood(state)).toEqual({ ok: true, healed: 20 });
    expect(state.playerHp).toBe(70);
    expect(state.inventory.counts.food).toBe(1);
  });

  it('caps at maxHp', () => {
    const state = makeGameState();
    state.playerHp = state.playerMaxHp - 5;
    addItem(state.inventory, 'food', 1);
    consumeFood(state);
    expect(state.playerHp).toBe(state.playerMaxHp);
  });
});

describe('consumePotion', () => {
  it('heals 40 HP', () => {
    const state = makeGameState();
    state.playerHp = 30;
    addItem(state.inventory, 'potion', 1);
    expect(consumePotion(state)).toEqual({ ok: true, healed: 40 });
    expect(state.playerHp).toBe(70);
    expect(state.inventory.counts.potion).toBeUndefined();
  });
});
