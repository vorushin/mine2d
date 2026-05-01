import { describe, expect, it } from 'vitest';
import { chooseNightTwist, modifiedNightTarget, NIGHT_TWISTS } from '../src/systems/NightTwists';

describe('NightTwists', () => {
  it('keeps night one and boss nights predictable', () => {
    expect(chooseNightTwist(1, () => 0).kind).toBe('normal');
    expect(chooseNightTwist(5, () => 0).kind).toBe('normal');
  });

  it('selects special nights from deterministic rolls', () => {
    expect(chooseNightTwist(4, () => 0.1).kind).toBe('runners');
    expect(chooseNightTwist(3, () => 0.3).kind).toBe('swarm');
    expect(chooseNightTwist(3, () => 0.6).kind).toBe('treasure');
    expect(chooseNightTwist(3, () => 0.9).kind).toBe('normal');
  });

  it('modifies target counts by twist multiplier', () => {
    expect(modifiedNightTarget(20, NIGHT_TWISTS.normal)).toBe(20);
    expect(modifiedNightTarget(20, NIGHT_TWISTS.swarm)).toBe(27);
    expect(modifiedNightTarget(20, NIGHT_TWISTS.runners)).toBe(22);
  });
});
