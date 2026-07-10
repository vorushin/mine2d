import { describe, expect, it } from 'vitest';
import { chooseNightTwist, modifiedNightTarget, NIGHT_TWISTS } from '../src/systems/NightTwists';

describe('NightTwists', () => {
  it('keeps night one and boss nights predictable', () => {
    expect(chooseNightTwist(1, () => 0).kind).toBe('normal');
    expect(chooseNightTwist(5, () => 0).kind).toBe('normal');
  });

  it('selects special nights from deterministic rolls', () => {
    expect(chooseNightTwist(3, () => 0.1).kind).toBe('goblins');
    expect(chooseNightTwist(4, () => 0.25).kind).toBe('runners');
    expect(chooseNightTwist(4, () => 0.35).kind).toBe('fog');
    expect(chooseNightTwist(4, () => 0.45).kind).toBe('meteors');
    expect(chooseNightTwist(6, () => 0.52).kind).toBe('frost');
    expect(chooseNightTwist(3, () => 0.5).kind).toBe('swarm');
    expect(chooseNightTwist(3, () => 0.75).kind).toBe('treasure');
    expect(chooseNightTwist(3, () => 0.9).kind).toBe('normal');
  });

  it('early nights never roll the harder twists', () => {
    expect(chooseNightTwist(2, () => 0.35).kind).not.toBe('fog');
    expect(chooseNightTwist(4, () => 0.52).kind).not.toBe('frost'); // frost needs night 5+
    expect(NIGHT_TWISTS.frost.enemyHpMult).toBeGreaterThan(1);
    expect(NIGHT_TWISTS.fog.fog).toBe(true);
    expect(NIGHT_TWISTS.meteors.nightMeteors).toBe(true);
  });

  it('modifies target counts by twist multiplier', () => {
    expect(modifiedNightTarget(20, NIGHT_TWISTS.normal)).toBe(20);
    expect(modifiedNightTarget(20, NIGHT_TWISTS.swarm)).toBe(27);
    expect(modifiedNightTarget(20, NIGHT_TWISTS.runners)).toBe(22);
    expect(modifiedNightTarget(20, NIGHT_TWISTS.goblins)).toBe(23);
  });
});
