import { describe, expect, it } from 'vitest';
import { SpawnDirector } from '../src/systems/SpawnDirector';
import { NIGHT_TWISTS } from '../src/systems/NightTwists';

function nightState(night: number, elapsed: number, depth: 0 | 1 | 2 | 3 = 0) {
  return { phase: 'night' as const, nightNumber: night, phaseElapsedMs: elapsed, depth };
}

describe('SpawnDirector', () => {
  it('applies the twist multiplier to the night target', () => {
    const d = new SpawnDirector(() => 0.5);
    expect(d.beginNight(20, NIGHT_TWISTS.normal)).toBe(20);
    expect(d.beginNight(20, NIGHT_TWISTS.swarm)).toBe(27); // ceil(20 * 1.35)
    expect(d.beginNight(20, NIGHT_TWISTS.normal, 10)).toBe(30);
  });

  it('spawns exactly the target number of zombies over a night', () => {
    const d = new SpawnDirector(() => 0.9); // no mini-waves
    const target = d.beginNight(20, NIGHT_TWISTS.normal);
    let spawned = 0;
    let elapsed = 0;
    while (elapsed < 120000) {
      const reqs = d.update(500, nightState(3, elapsed));
      spawned += reqs.filter((r) => r.kind === 'zombie').length;
      elapsed += 500;
    }
    expect(spawned).toBe(target);
    expect(d.allSpawned).toBe(true);
  });

  it('never spawns during the day or while underground', () => {
    const d = new SpawnDirector(() => 0.9);
    d.beginNight(20, NIGHT_TWISTS.normal);
    expect(d.update(5000, { phase: 'day', nightNumber: 3, phaseElapsedMs: 0, depth: 0 })).toEqual([]);
    expect(d.update(5000, nightState(3, 20000, 2))).toEqual([]);
  });

  it('requests the boss exactly once on every 5th night after the delay', () => {
    const d = new SpawnDirector(() => 0.9);
    d.beginNight(20, NIGHT_TWISTS.normal);
    expect(d.update(500, nightState(5, 3000)).some((r) => r.kind === 'boss')).toBe(false);
    const first = d.update(500, nightState(5, 16000));
    expect(first.filter((r) => r.kind === 'boss')).toHaveLength(1);
    const again = d.update(500, nightState(5, 17000));
    expect(again.some((r) => r.kind === 'boss')).toBe(false);
  });

  it('no boss on non-multiple-of-5 nights', () => {
    const d = new SpawnDirector(() => 0.9);
    d.beginNight(20, NIGHT_TWISTS.normal);
    expect(d.update(500, nightState(4, 60000)).some((r) => r.kind === 'boss')).toBe(false);
  });

  it('cave spawns respect the alive cap and floor pacing', () => {
    const d = new SpawnDirector(() => 0.5);
    expect(d.updateCave(60000, 1, 'day', 12)).toEqual([]); // cap 12 on floor 1
    let got = 0;
    for (let t = 0; t < 60000; t += 500) {
      got += d.updateCave(500, 1, 'day', 0).length;
    }
    expect(got).toBeGreaterThanOrEqual(8);
    expect(got).toBeLessThanOrEqual(14);
    expect(d.updateCave(500, 0, 'day', 0)).toEqual([]); // surface: no cave spawns
  });
});
