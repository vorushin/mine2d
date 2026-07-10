import { describe, expect, it } from 'vitest';
import {
  BOSS_INTROS, KING_PHASES, bossKindForNight, kingPhase, kingSpec,
  pickFallenToRaise, specForBossKind, FallenRecord,
} from '../src/systems/Bosses';
import { RECIPES, applyCraft, canCraft } from '../src/systems/Crafting';
import { makeGameState, addItem } from '../src/state/GameState';

describe('boss rotation', () => {
  it('cycles necromancer → spider queen → golem every 5 nights', () => {
    expect(bossKindForNight(5)).toBe('necromancer');
    expect(bossKindForNight(10)).toBe('spiderQueen');
    expect(bossKindForNight(15)).toBe('golem');
    expect(bossKindForNight(20)).toBe('necromancer');
    expect(bossKindForNight(25)).toBe('spiderQueen');
  });

  it('boss specs scale with night and carry their mechanics', () => {
    const early = specForBossKind('necromancer', 5);
    const late = specForBossKind('necromancer', 20);
    expect(late.hp).toBeGreaterThan(early.hp);
    expect(specForBossKind('golem', 15).projectileResistant).toBe(true);
    expect(specForBossKind('spiderQueen', 10).layWebs).toBe(true);
    expect(specForBossKind('necromancer', 5).bossKind).toBe('necromancer');
  });

  it('every boss kind has an intro card', () => {
    for (const kind of ['necromancer', 'spiderQueen', 'golem', 'king'] as const) {
      expect(BOSS_INTROS[kind].title.length).toBeGreaterThan(0);
      expect(BOSS_INTROS[kind].tip.length).toBeGreaterThan(0);
    }
  });
});

describe('the Zombie King', () => {
  it('phases at 50% and 25% health', () => {
    expect(kingPhase(1)).toBe(1);
    expect(kingPhase(0.51)).toBe(1);
    expect(kingPhase(0.5)).toBe(2);
    expect(kingPhase(0.26)).toBe(2);
    expect(kingPhase(0.25)).toBe(3);
    expect(kingPhase(0.01)).toBe(3);
  });

  it('later phases are faster, summon more, and smash walls harder', () => {
    expect(KING_PHASES[2].speedMult).toBeGreaterThan(KING_PHASES[1].speedMult);
    expect(KING_PHASES[3].summonCount).toBeGreaterThan(KING_PHASES[1].summonCount);
    expect(KING_PHASES[3].wallDamageMult).toBeGreaterThan(KING_PHASES[2].wallDamageMult);
    expect(KING_PHASES[3].summonEveryMs).toBeLessThan(KING_PHASES[1].summonEveryMs);
  });

  it('king spec is a proper monster', () => {
    const spec = kingSpec(12);
    expect(spec.variant).toBe('king');
    expect(spec.hp).toBeGreaterThan(specForBossKind('golem', 12).hp);
  });
});

describe('necromancer ritual', () => {
  it('raises only un-raised fallen and marks them', () => {
    const fallen: FallenRecord[] = [
      { x: 1, y: 1, raised: true },
      { x: 2, y: 2, raised: false },
      { x: 3, y: 3, raised: false },
      { x: 4, y: 4, raised: false },
      { x: 5, y: 5, raised: false },
    ];
    const raised = pickFallenToRaise(fallen, 3);
    expect(raised.map((f) => f.x)).toEqual([2, 3, 4]);
    expect(fallen.filter((f) => f.raised)).toHaveLength(4);
    // Second ritual only finds the one remaining
    expect(pickFallenToRaise(fallen, 3)).toHaveLength(1);
    expect(pickFallenToRaise(fallen, 3)).toHaveLength(0);
  });
});

describe('crystal key', () => {
  it('consumes 2 souls + 3 crystal and unlocks once', () => {
    const state = makeGameState();
    addItem(state.inventory, 'soul', 2);
    addItem(state.inventory, 'crystal', 3);
    const recipe = RECIPES.find((r) => r.id === 'crystal_key')!;
    expect(applyCraft(recipe, state)).toEqual({ ok: true });
    expect(state.hasCrystalKey).toBe(true);
    expect(state.inventory.counts.soul).toBeUndefined();
    addItem(state.inventory, 'soul', 2);
    addItem(state.inventory, 'crystal', 3);
    expect(canCraft(recipe, state)).toEqual({ ok: false, reason: 'already_have' });
  });
});
