import { describe, expect, it } from 'vitest';
import { makeGameState } from '../src/state/GameState';
import {
  applyPowerUp,
  damageMultiplierForState,
  incomingDamageMultiplierForState,
  randomPowerUpKind,
  speedMultiplierForState,
  tickPowerUps,
} from '../src/systems/PowerUps';

describe('PowerUps', () => {
  it('applies movement, damage, and shield multipliers', () => {
    const state = makeGameState();
    expect(speedMultiplierForState(state)).toBe(1);
    expect(damageMultiplierForState(state)).toBe(1);
    expect(incomingDamageMultiplierForState(state)).toBe(1);

    applyPowerUp(state, 'haste');
    applyPowerUp(state, 'fury');
    applyPowerUp(state, 'shield');

    expect(speedMultiplierForState(state)).toBeGreaterThan(1);
    expect(damageMultiplierForState(state)).toBeGreaterThan(1);
    expect(incomingDamageMultiplierForState(state)).toBeLessThan(1);
  });

  it('ticks timers down without going negative', () => {
    const state = makeGameState();
    applyPowerUp(state, 'haste');

    tickPowerUps(state, 5000);
    expect(state.activeBuffs.hasteMs).toBeGreaterThan(0);

    tickPowerUps(state, 999999);
    expect(state.activeBuffs.hasteMs).toBe(0);
    expect(speedMultiplierForState(state)).toBe(1);
  });

  it('does not shorten an already active power', () => {
    const state = makeGameState();
    applyPowerUp(state, 'fury');
    tickPowerUps(state, 3000);
    const remaining = state.activeBuffs.furyMs;
    applyPowerUp(state, 'fury');
    expect(state.activeBuffs.furyMs).toBeGreaterThan(remaining);
  });

  it('picks deterministic kinds from a seed-like number', () => {
    expect(randomPowerUpKind(0)).toBe('haste');
    expect(randomPowerUpKind(1)).toBe('fury');
    expect(randomPowerUpKind(2)).toBe('shield');
    expect(randomPowerUpKind(3)).toBe('haste');
  });
});
