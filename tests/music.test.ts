import { describe, expect, it } from 'vitest';
import { THEME_IDS, buildTheme } from '../src/systems/Music';

describe('music themes', () => {
  it('provides a 16-step pattern for every theme', () => {
    expect(THEME_IDS).toEqual(['menu', 'day', 'night', 'boss', 'caves', 'victory']);
    for (const id of THEME_IDS) {
      const t = buildTheme(id);
      expect(t.lead).toHaveLength(16);
      expect(t.bass).toHaveLength(16);
      expect(t.perc).toHaveLength(16);
    }
  });

  it('keeps bpm in a sane range', () => {
    for (const id of THEME_IDS) {
      const t = buildTheme(id);
      expect(t.bpm).toBeGreaterThanOrEqual(70);
      expect(t.bpm).toBeLessThanOrEqual(160);
    }
  });

  it('keeps every note inside the theme scale', () => {
    for (const id of THEME_IDS) {
      const t = buildTheme(id);
      for (const n of [...t.lead, ...t.bass]) {
        if (n === null) continue;
        const pc = ((n % 12) + 12) % 12;
        expect(t.scale, `${id} note ${n}`).toContain(pc);
      }
    }
  });

  it('day and night themes differ and builds are deterministic', () => {
    expect(JSON.stringify(buildTheme('day'))).not.toEqual(JSON.stringify(buildTheme('night')));
    expect(buildTheme('boss')).toEqual(buildTheme('boss'));
  });
});
