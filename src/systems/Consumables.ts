import { GameState, hasItem, removeItem } from '../state/GameState';

export interface ConsumeResult {
  ok: boolean;
  healed?: number;
}

export const FOOD_HEAL = 20;
export const POTION_HEAL = 40;

export function consumeFood(state: GameState): ConsumeResult {
  if (!hasItem(state.inventory, 'food', 1)) return { ok: false };
  removeItem(state.inventory, 'food', 1);
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + FOOD_HEAL);
  return { ok: true, healed: FOOD_HEAL };
}

export function consumePotion(state: GameState): ConsumeResult {
  if (!hasItem(state.inventory, 'potion', 1)) return { ok: false };
  removeItem(state.inventory, 'potion', 1);
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + POTION_HEAL);
  return { ok: true, healed: POTION_HEAL };
}
