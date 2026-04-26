import { describe, it, expect } from 'vitest';
import { selectAutoAimTarget, AimTarget } from '../src/ui/autoAim';

const T = (x: number, y: number): AimTarget => ({ x, y });

describe('selectAutoAimTarget', () => {
  it('returns null if no targets are present', () => {
    expect(selectAutoAimTarget(0, 0, 1, 0, [])).toBeNull();
  });

  it('returns the only target inside the ±45° arc', () => {
    const t = T(100, 0);
    expect(selectAutoAimTarget(0, 0, 1, 0, [t])).toBe(t);
  });

  it('returns the nearest target inside the arc', () => {
    const near = T(50, 0);
    const far = T(200, 0);
    expect(selectAutoAimTarget(0, 0, 1, 0, [far, near])).toBe(near);
  });

  it('ignores targets outside the ±45° arc', () => {
    const behind = T(-100, 0);
    expect(selectAutoAimTarget(0, 0, 1, 0, [behind])).toBeNull();
  });

  it('honors the arc boundary at exactly 45°', () => {
    const onEdge = T(100, 100);
    expect(selectAutoAimTarget(0, 0, 1, 0, [onEdge])).toBe(onEdge);
    const justOutside = T(100, 110);
    expect(selectAutoAimTarget(0, 0, 1, 0, [justOutside])).toBeNull();
  });

  it('rejects targets beyond max range', () => {
    const t = T(1000, 0);
    expect(selectAutoAimTarget(0, 0, 1, 0, [t], 500)).toBeNull();
  });
});
