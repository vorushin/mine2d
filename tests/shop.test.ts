import { describe, it, expect } from 'vitest';
import { SHOP_OFFERS, firstAffordablePayment, buy } from '../src/systems/Shop';
import { makeGameState, addItem, hasItem } from '../src/state/GameState';

function offerById(id: string) {
  const o = SHOP_OFFERS.find((o) => o.id === id);
  if (!o) throw new Error(id);
  return o;
}

describe('Shop', () => {
  it('picks gold when gold is available', () => {
    const s = makeGameState();
    addItem(s.inventory, 'gold', 5);
    const offer = offerById('arrow_x10');
    const p = firstAffordablePayment(offer, s);
    expect(p?.kind).toBe('gold');
  });

  it('falls back to barter when no gold', () => {
    const s = makeGameState();
    addItem(s.inventory, 'wood', 100);
    const offer = offerById('arrow_x10');
    const p = firstAffordablePayment(offer, s);
    expect(p?.kind).toBe('barter');
  });

  it('buy reduces inventory and grants item', () => {
    const s = makeGameState();
    addItem(s.inventory, 'gold', 5);
    const offer = offerById('arrow_x10');
    const p = firstAffordablePayment(offer, s)!;
    const res = buy(offer, p, s);
    expect(res.ok).toBe(true);
    expect(hasItem(s.inventory, 'arrow', 10)).toBe(true);
    expect(hasItem(s.inventory, 'gold', 4)).toBe(false); // consumed 2
    expect(hasItem(s.inventory, 'gold', 3)).toBe(true);
  });

  it('cannot pay returns error', () => {
    const s = makeGameState();
    const offer = offerById('arrow_x10');
    expect(firstAffordablePayment(offer, s)).toBeNull();
  });

  it('pistol unlock flips flag', () => {
    const s = makeGameState();
    addItem(s.inventory, 'gold', 99);
    const offer = offerById('pistol');
    const p = firstAffordablePayment(offer, s)!;
    expect(buy(offer, p, s).ok).toBe(true);
    expect(s.hasPistol).toBe(true);
  });
});
