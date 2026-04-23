import { describe, it, expect } from 'vitest';
import { planExpansion } from '../src/systems/DynamicTerrain';
import { initialRevealedBounds, isInBounds } from '../src/state/GameState';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config';

describe('planExpansion', () => {
  it('grows bounds by ring on every side', () => {
    const b = { xMin: 30, yMin: 30, xMax: 60, yMax: 60 };
    const next = planExpansion(b, 100, 100, 3);
    expect(next).toEqual({ xMin: 27, yMin: 27, xMax: 63, yMax: 63 });
  });

  it('clamps to world edges', () => {
    const b = { xMin: 1, yMin: 0, xMax: 98, yMax: 99 };
    const next = planExpansion(b, 100, 100, 5);
    expect(next).toEqual({ xMin: 0, yMin: 0, xMax: 99, yMax: 99 });
  });

  it('is idempotent at full world size', () => {
    const full = { xMin: 0, yMin: 0, xMax: 99, yMax: 99 };
    expect(planExpansion(full, 100, 100, 3)).toEqual(full);
  });
});

describe('initialRevealedBounds', () => {
  it('is a centered region inside the world', () => {
    const b = initialRevealedBounds();
    expect(b.xMin).toBeGreaterThanOrEqual(0);
    expect(b.yMin).toBeGreaterThanOrEqual(0);
    expect(b.xMax).toBeLessThan(WORLD_WIDTH);
    expect(b.yMax).toBeLessThan(WORLD_HEIGHT);
    // Reasonably sized
    expect(b.xMax - b.xMin).toBeGreaterThan(10);
    expect(b.yMax - b.yMin).toBeGreaterThan(10);
  });
});

describe('isInBounds', () => {
  const b = { xMin: 10, yMin: 10, xMax: 20, yMax: 20 };
  it('accepts tiles inside (inclusive)', () => {
    expect(isInBounds(b, 10, 10)).toBe(true);
    expect(isInBounds(b, 20, 20)).toBe(true);
    expect(isInBounds(b, 15, 15)).toBe(true);
  });
  it('rejects tiles outside', () => {
    expect(isInBounds(b, 9, 15)).toBe(false);
    expect(isInBounds(b, 21, 15)).toBe(false);
    expect(isInBounds(b, 15, 9)).toBe(false);
    expect(isInBounds(b, 15, 21)).toBe(false);
  });
});
