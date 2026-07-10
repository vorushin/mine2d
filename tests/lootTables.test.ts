import { describe, expect, it } from 'vitest';
import { bossLoot, crateLoot, cryptLoot, rollKillDrops, treasureDigLoot, vaultLoot } from '../src/systems/LootTables';

describe('LootTables', () => {
  it('goblins always drop scaled gold', () => {
    const drops = rollKillDrops({ variant: 'goblin', night: 8, combo: 0, bloodMoon: false, lootMultiplier: 1, rand: () => 0.99 });
    expect(drops[0]).toEqual({ m: 'gold', c: 4 }); // 2 + floor(8/4)
  });

  it('generous rand yields the full drop set with combo gold bonus', () => {
    const drops = rollKillDrops({ variant: 'normal', night: 1, combo: 15, bloodMoon: false, lootMultiplier: 1, rand: () => 0 });
    expect(drops).toEqual([
      { m: 'gold', c: 4 }, // 1 + min(3, floor(15/5))
      { m: 'wood', c: 1 },
      { m: 'stone', c: 1 },
      { m: 'iron', c: 1 },
    ]);
  });

  it('stingy rand yields nothing for a plain zombie', () => {
    const drops = rollKillDrops({ variant: 'normal', night: 1, combo: 0, bloodMoon: false, lootMultiplier: 1, rand: () => 0.999 });
    expect(drops).toEqual([]);
  });

  it('blood moon multiplier makes rare drops more likely', () => {
    // 0.4 fails the 0.32 wood check normally but passes 0.32*1.5=0.48 on a blood moon
    const normal = rollKillDrops({ variant: 'normal', night: 1, combo: 0, bloodMoon: false, lootMultiplier: 1, rand: () => 0.4 });
    const moon = rollKillDrops({ variant: 'normal', night: 1, combo: 0, bloodMoon: true, lootMultiplier: 1, rand: () => 0.4 });
    expect(normal.some((d) => d.m === 'wood')).toBe(false);
    expect(moon.some((d) => d.m === 'wood')).toBe(true);
  });

  it('fixed tables stay generous', () => {
    expect(bossLoot().length).toBeGreaterThanOrEqual(5);
    expect(crateLoot().some((d) => d.m === 'gold')).toBe(true);
    expect(cryptLoot().some((d) => d.m === 'gold')).toBe(true);
  });

  it('vault loot gets richer with depth and can hold crystal', () => {
    const floor1 = vaultLoot(1, () => 0.99);
    const floor3 = vaultLoot(3, () => 0.1);
    expect(floor1.find((d) => d.m === 'gold')!.c).toBe(4);
    expect(floor3.some((d) => d.m === 'crystal')).toBe(true);
  });

  it('treasure digs always pay gold', () => {
    expect(treasureDigLoot(() => 0.99)[0].m).toBe('gold');
  });
});
