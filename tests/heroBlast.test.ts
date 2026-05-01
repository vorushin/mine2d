import { describe, expect, it } from 'vitest';
import { makeGameState } from '../src/state/GameState';
import {
  HERO_BLAST_MAX_CHARGE,
  addHeroCharge,
  canUseHeroBlast,
  consumeHeroBlast,
  heroChargeForKill,
} from '../src/systems/HeroBlast';

describe('HeroBlast', () => {
  it('charges up and clamps at max', () => {
    const state = makeGameState();
    addHeroCharge(state, 40);
    expect(state.heroCharge).toBe(40);
    addHeroCharge(state, 999);
    expect(state.heroCharge).toBe(HERO_BLAST_MAX_CHARGE);
    expect(canUseHeroBlast(state)).toBe(true);
  });

  it('consumes only when fully charged', () => {
    const state = makeGameState();
    addHeroCharge(state, 50);
    expect(consumeHeroBlast(state)).toBe(false);
    expect(state.heroCharge).toBe(50);

    addHeroCharge(state, 50);
    expect(consumeHeroBlast(state)).toBe(true);
    expect(state.heroCharge).toBe(0);
  });

  it('rewards tougher and special enemies with more charge', () => {
    expect(heroChargeForKill('normal')).toBeLessThan(heroChargeForKill('brute'));
    expect(heroChargeForKill('goblin')).toBeGreaterThan(heroChargeForKill('normal'));
    expect(heroChargeForKill('boss')).toBe(HERO_BLAST_MAX_CHARGE);
  });
});
