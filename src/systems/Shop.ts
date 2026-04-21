import { MaterialId } from '../world/tileTypes';
import { GameState, addItem, hasItem, removeItem } from '../state/GameState';

export type ShopPayment =
  | { kind: 'gold'; count: number }
  | { kind: 'barter'; material: MaterialId; count: number };

export type ShopAction =
  | { kind: 'material'; material: MaterialId; count: number }
  | { kind: 'unlock_pistol' }
  | { kind: 'heal'; amount: number };

export interface ShopOffer {
  id: string;
  label: string;
  payments: ShopPayment[];
  effect: ShopAction;
  oncePerRun?: boolean;
}

export const SHOP_OFFERS: ShopOffer[] = [
  {
    id: 'arrow_x10',
    label: '10 Arrows',
    payments: [{ kind: 'gold', count: 2 }, { kind: 'barter', material: 'wood', count: 6 }],
    effect: { kind: 'material', material: 'arrow', count: 10 },
  },
  {
    id: 'bullet_x5',
    label: '5 Bullets',
    payments: [{ kind: 'gold', count: 3 }, { kind: 'barter', material: 'iron', count: 2 }],
    effect: { kind: 'material', material: 'bullet', count: 5 },
  },
  {
    id: 'potion',
    label: 'Health Potion (+40)',
    payments: [{ kind: 'gold', count: 2 }, { kind: 'barter', material: 'iron', count: 1 }],
    effect: { kind: 'heal', amount: 40 },
  },
  {
    id: 'big_potion',
    label: 'Big Health Potion (+80)',
    payments: [{ kind: 'gold', count: 5 }, { kind: 'barter', material: 'iron', count: 4 }],
    effect: { kind: 'heal', amount: 80 },
  },
  {
    id: 'food_x3',
    label: '3 Food',
    payments: [{ kind: 'gold', count: 2 }, { kind: 'barter', material: 'wood', count: 6 }],
    effect: { kind: 'material', material: 'food', count: 3 },
  },
  {
    id: 'lava_x1',
    label: '1 Lava',
    payments: [{ kind: 'gold', count: 4 }, { kind: 'barter', material: 'iron', count: 3 }],
    effect: { kind: 'material', material: 'lava', count: 1 },
  },
  {
    id: 'pistol',
    label: 'Pistol (unlock)',
    payments: [{ kind: 'gold', count: 12 }, { kind: 'barter', material: 'iron', count: 10 }],
    effect: { kind: 'unlock_pistol' },
    oncePerRun: true,
  },
];

export interface ShopPurchaseResult {
  ok: boolean;
  reason?: 'cannot_pay' | 'already_owned';
}

/** Returns the first payment the player can afford, or null. */
export function firstAffordablePayment(offer: ShopOffer, state: GameState): ShopPayment | null {
  for (const p of offer.payments) {
    if (p.kind === 'gold' && hasItem(state.inventory, 'gold', p.count)) return p;
    if (p.kind === 'barter' && hasItem(state.inventory, p.material, p.count)) return p;
  }
  return null;
}

export function buy(offer: ShopOffer, payment: ShopPayment, state: GameState): ShopPurchaseResult {
  if (offer.effect.kind === 'unlock_pistol' && state.hasPistol) return { ok: false, reason: 'already_owned' };

  if (payment.kind === 'gold') {
    if (!removeItem(state.inventory, 'gold', payment.count)) return { ok: false, reason: 'cannot_pay' };
  } else {
    if (!removeItem(state.inventory, payment.material, payment.count)) return { ok: false, reason: 'cannot_pay' };
  }

  const eff = offer.effect;
  switch (eff.kind) {
    case 'material':
      addItem(state.inventory, eff.material, eff.count);
      break;
    case 'unlock_pistol':
      state.hasPistol = true;
      break;
    case 'heal':
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + eff.amount);
      break;
  }
  return { ok: true };
}
