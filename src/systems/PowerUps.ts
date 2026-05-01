import { GameState, PowerUpKind } from '../state/GameState';

export interface PowerUpSpec {
  kind: PowerUpKind;
  label: string;
  shortLabel: string;
  color: number;
  durationMs: number;
}

export const POWER_UP_SPECS: Record<PowerUpKind, PowerUpSpec> = {
  haste: {
    kind: 'haste',
    label: 'Turbo Boots',
    shortLabel: 'FAST',
    color: 0x4dd7ff,
    durationMs: 12000,
  },
  fury: {
    kind: 'fury',
    label: 'Mega Hits',
    shortLabel: 'HIT',
    color: 0xff6655,
    durationMs: 12000,
  },
  shield: {
    kind: 'shield',
    label: 'Bubble Shield',
    shortLabel: 'SAFE',
    color: 0x9cff9c,
    durationMs: 15000,
  },
};

export function applyPowerUp(state: GameState, kind: PowerUpKind): PowerUpSpec {
  const spec = POWER_UP_SPECS[kind];
  switch (kind) {
    case 'haste':
      state.activeBuffs.hasteMs = Math.max(state.activeBuffs.hasteMs, spec.durationMs);
      break;
    case 'fury':
      state.activeBuffs.furyMs = Math.max(state.activeBuffs.furyMs, spec.durationMs);
      break;
    case 'shield':
      state.activeBuffs.shieldMs = Math.max(state.activeBuffs.shieldMs, spec.durationMs);
      break;
  }
  return spec;
}

export function tickPowerUps(state: GameState, deltaMs: number): void {
  state.activeBuffs.hasteMs = Math.max(0, state.activeBuffs.hasteMs - deltaMs);
  state.activeBuffs.furyMs = Math.max(0, state.activeBuffs.furyMs - deltaMs);
  state.activeBuffs.shieldMs = Math.max(0, state.activeBuffs.shieldMs - deltaMs);
}

export function speedMultiplierForState(state: GameState): number {
  return state.activeBuffs.hasteMs > 0 ? 1.45 : 1;
}

export function damageMultiplierForState(state: GameState): number {
  return state.activeBuffs.furyMs > 0 ? 1.6 : 1;
}

export function incomingDamageMultiplierForState(state: GameState): number {
  return state.activeBuffs.shieldMs > 0 ? 0.45 : 1;
}

export function randomPowerUpKind(seed: number): PowerUpKind {
  const n = Math.abs(Math.floor(seed)) % 3;
  if (n === 0) return 'haste';
  if (n === 1) return 'fury';
  return 'shield';
}
