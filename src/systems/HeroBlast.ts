import type { GameState } from '../state/GameState';
import type { ZombieVariant } from '../entities/Zombie';

export const HERO_BLAST_MAX_CHARGE = 100;
export const HERO_BLAST_RADIUS_PX = 128;
export const HERO_BLAST_DAMAGE = 58;

export function addHeroCharge(state: GameState, amount: number): number {
  state.heroCharge = Math.max(0, Math.min(HERO_BLAST_MAX_CHARGE, state.heroCharge + amount));
  return state.heroCharge;
}

export function canUseHeroBlast(state: GameState): boolean {
  return state.heroCharge >= HERO_BLAST_MAX_CHARGE;
}

export function consumeHeroBlast(state: GameState): boolean {
  if (!canUseHeroBlast(state)) return false;
  state.heroCharge = 0;
  return true;
}

export function heroChargeForKill(variant?: ZombieVariant): number {
  switch (variant) {
    case 'boss':
    case 'king':
      return HERO_BLAST_MAX_CHARGE;
    case 'skeleton':
      return 12;
    case 'spider':
    case 'bat':
      return 8;
    case 'spiderling':
      return 4;
    case 'brute':
      return 18;
    case 'armored':
      return 14;
    case 'goblin':
      return 12;
    case 'fast':
      return 10;
    case 'normal':
    default:
      return 8;
  }
}
