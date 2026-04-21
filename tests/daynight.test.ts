import { describe, it, expect } from 'vitest';
import { DayNightCycle } from '../src/systems/DayNightCycle';
import { makeGameState } from '../src/state/GameState';
import { DAY_DURATION_MS, NIGHT_DURATION_MS, DUSK_DURATION_MS, DAWN_DURATION_MS } from '../src/config';

describe('DayNightCycle', () => {
  it('starts in day', () => {
    const s = makeGameState();
    expect(s.phase).toBe('day');
  });

  it('skips to night only when currently day', () => {
    const s = makeGameState();
    const c = new DayNightCycle(s);
    c.skipToNight();
    expect(s.phase).toBe('dusk');
    c.skipToNight();
    expect(s.phase).toBe('dusk'); // unchanged
  });

  it('advances phases in order day→dusk→night→dawn→day', () => {
    const s = makeGameState();
    const c = new DayNightCycle(s);
    c.tick(DAY_DURATION_MS + 1);
    expect(s.phase).toBe('dusk');
    c.tick(DUSK_DURATION_MS + 1);
    expect(s.phase).toBe('night');
    c.tick(NIGHT_DURATION_MS + 1);
    expect(s.phase).toBe('dawn');
    c.tick(DAWN_DURATION_MS + 1);
    expect(s.phase).toBe('day');
    expect(s.nightNumber).toBe(2);
    expect(s.score).toBe(1);
  });

  it('zombiesForNight scales up', () => {
    const c = new DayNightCycle(makeGameState());
    const n1 = c.zombiesForNight(1);
    const n5 = c.zombiesForNight(5);
    expect(n5).toBeGreaterThan(n1);
  });
});
