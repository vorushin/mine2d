import { describe, it, expect } from 'vitest';
import { snap8Way } from '../src/ui/aimMath';

describe('snap8Way', () => {
  it('returns null inside the default deadzone', () => {
    expect(snap8Way(0, 0)).toBeNull();
    expect(snap8Way(0.1, 0.1)).toBeNull();
    expect(snap8Way(-0.2, 0.0)).toBeNull();
  });

  it('snaps to E for stick pushed right', () => {
    expect(snap8Way(1, 0)).toEqual({ dx: 1, dy: 0 });
  });

  it('snaps to W for stick pushed left', () => {
    expect(snap8Way(-1, 0)).toEqual({ dx: -1, dy: 0 });
  });

  it('snaps to N for stick pushed up (negative y)', () => {
    expect(snap8Way(0, -1)).toEqual({ dx: 0, dy: -1 });
  });

  it('snaps to S for stick pushed down', () => {
    expect(snap8Way(0, 1)).toEqual({ dx: 0, dy: 1 });
  });

  it('snaps to NE for stick pushed up-right', () => {
    expect(snap8Way(0.7, -0.7)).toEqual({ dx: 1, dy: -1 });
  });

  it('snaps to SW for stick pushed down-left', () => {
    expect(snap8Way(-0.7, 0.7)).toEqual({ dx: -1, dy: 1 });
  });

  it('honors a custom deadzone', () => {
    expect(snap8Way(0.4, 0, 0.5)).toBeNull();
    expect(snap8Way(0.6, 0, 0.5)).toEqual({ dx: 1, dy: 0 });
  });
});
