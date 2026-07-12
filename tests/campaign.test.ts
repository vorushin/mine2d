import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
  CAMPAIGN_LEVELS, CAMPAIGN_WORLDS, CampaignLevelDef, CampaignObjectiveDef,
  campaignAllowsCaves, campaignAllowsOffer, campaignAllowsRecipe, campaignNightPlan,
  campaignObjectiveLines, campaignShopClosed, levelById, levelIndexOf, levelsOfWorld,
  makeCampaignRunState, objectiveGoal, objectiveLabel, objectiveProgress,
  rulesForLevel, starsForNights, unlockBadges, updateCampaignObjectives,
} from '../src/systems/Campaign';
import { CampaignStore } from '../src/systems/CampaignStore';
import { GameState, addItem, makeGameState, removeItem } from '../src/state/GameState';
import { HOTBAR, cyclePrimaryHotbarSlot, hotbarAvailable, hotbarCampaignLocked, PRIMARY_HOTBAR_SLOTS } from '../src/ui/hotbarDef';
import { buildPickerCells } from '../src/ui/buildPickerData';
import { RECIPES } from '../src/systems/Crafting';
import { SHOP_OFFERS } from '../src/systems/Shop';
import { SpawnDirector } from '../src/systems/SpawnDirector';
import { NIGHT_TWISTS } from '../src/systems/NightTwists';
import { generateWorld } from '../src/world/generate';
import { findCrypts } from '../src/systems/Graveyards';
import { TileType } from '../src/world/tileTypes';

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
      },
    });
  }
});

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

function campaignState(levelId: string): GameState {
  const def = levelById(levelId)!;
  const state = makeGameState();
  state.campaign = makeCampaignRunState(def);
  state.nightNumber = def.startNight;
  Object.assign(state, def.start ?? {});
  return state;
}

// --- Definitions -----------------------------------------------------------------

describe('campaign definitions', () => {
  it('has 6 worlds of 3 levels each, with unique ids', () => {
    expect(CAMPAIGN_WORLDS).toHaveLength(6);
    expect(CAMPAIGN_LEVELS).toHaveLength(18);
    const ids = new Set(CAMPAIGN_LEVELS.map((l) => l.id));
    expect(ids.size).toBe(18);
    for (const world of CAMPAIGN_WORLDS) {
      expect(levelsOfWorld(world.index)).toHaveLength(3);
    }
  });

  it('level fields are sane', () => {
    for (const lvl of CAMPAIGN_LEVELS) {
      expect(lvl.world).toBeGreaterThanOrEqual(1);
      expect(lvl.world).toBeLessThanOrEqual(6);
      expect(lvl.startNight).toBeGreaterThanOrEqual(1);
      expect(lvl.maxHp).toBeGreaterThanOrEqual(100);
      expect(lvl.reward).toBeGreaterThan(0);
      expect(lvl.parNights).toBeGreaterThanOrEqual(0);
      expect(lvl.objectives.length).toBeGreaterThan(0);
      for (const night of lvl.nights) expect(night.target).toBeGreaterThanOrEqual(0);
      // Survive objectives must be reachable within par (else 3 stars are impossible)
      for (const o of lvl.objectives) {
        if (o.kind === 'survive') expect(o.nights).toBeLessThanOrEqual(lvl.parNights);
      }
    }
  });

  it('every level resolves by id and by index', () => {
    for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
      const lvl = CAMPAIGN_LEVELS[i];
      expect(levelById(lvl.id)).toBe(lvl);
      expect(levelIndexOf(lvl.id)).toBe(i);
    }
    expect(levelById('nope')).toBeNull();
  });

  it('unlock deltas reference real hotbar labels, recipes, and shop offers', () => {
    const labels = new Set(HOTBAR.map((a) => a.label));
    const recipeIds = new Set(RECIPES.map((r) => r.id));
    const offerIds = new Set(SHOP_OFFERS.map((o) => o.id));
    for (const lvl of CAMPAIGN_LEVELS) {
      for (const l of lvl.unlocks.hotbar ?? []) expect(labels.has(l), `${lvl.id} hotbar ${l}`).toBe(true);
      for (const r of lvl.unlocks.recipes ?? []) expect(recipeIds.has(r), `${lvl.id} recipe ${r}`).toBe(true);
      for (const s of lvl.unlocks.shop ?? []) expect(offerIds.has(s), `${lvl.id} offer ${s}`).toBe(true);
    }
  });
});

// --- Progressive unlocks -----------------------------------------------------------

describe('progressive unlocks', () => {
  it('starts with just pickaxe & sword, no crafting, no shop, no caves', () => {
    const rules = rulesForLevel(0);
    expect(rules.hotbar.sort()).toEqual(['Pick', 'Sword']);
    expect(rules.recipes).toEqual([]);
    expect(rules.shop).toEqual([]);
    expect(rules.caves).toBe(false);
  });

  it('rules grow monotonically level over level', () => {
    for (let i = 1; i < CAMPAIGN_LEVELS.length; i++) {
      const prev = rulesForLevel(i - 1);
      const cur = rulesForLevel(i);
      for (const l of prev.hotbar) expect(cur.hotbar).toContain(l);
      for (const r of prev.recipes) expect(cur.recipes).toContain(r);
      for (const s of prev.shop) expect(cur.shop).toContain(s);
      if (prev.caves) expect(cur.caves).toBe(true);
    }
  });

  it('the final level has unlocked every tool, recipe, and shop offer in the game', () => {
    const rules = rulesForLevel(CAMPAIGN_LEVELS.length - 1);
    expect(new Set(rules.hotbar)).toEqual(new Set(HOTBAR.map((a) => a.label)));
    expect(new Set(rules.recipes)).toEqual(new Set(RECIPES.map((r) => r.id)));
    expect(new Set(rules.shop)).toEqual(new Set(SHOP_OFFERS.map((o) => o.id)));
    expect(rules.caves).toBe(true);
  });

  it('unlock badges name every delta', () => {
    const w2 = levelById('w2-1')!;
    const badges = unlockBadges(w2);
    expect(badges).toContain('Stone Wall');
    expect(badges.some((b) => b.includes('Stone Pickaxe'))).toBe(true);
    const w5 = levelById('w5-1')!;
    expect(unlockBadges(w5)).toContain('The Deep Dark');
  });
});

// --- Objective feasibility -----------------------------------------------------------

const TIER_RECIPE: Record<string, string> = {
  'pickaxe-1': 'stone_pickaxe', 'pickaxe-2': 'iron_pickaxe', 'pickaxe-3': 'crystal_pickaxe',
  'sword-1': 'iron_sword', 'sword-2': 'crystal_sword',
};
const OWN_SOURCE: Record<string, { recipe?: string; offer?: string; startFlag: keyof GameState }> = {
  bow: { recipe: 'bow', startFlag: 'hasBow' },
  pistol: { offer: 'pistol', startFlag: 'hasPistol' },
  hammer: { recipe: 'repair_hammer', startFlag: 'hasHammer' },
  freezeWand: { recipe: 'freeze_wand', startFlag: 'hasFreezeWand' },
  stormWand: { recipe: 'storm_wand', startFlag: 'hasStormWand' },
  rod: { recipe: 'fishing_rod', startFlag: 'hasRod' },
  crystalKey: { recipe: 'crystal_key', startFlag: 'hasCrystalKey' },
};

describe('objective feasibility', () => {
  it('every objective is achievable with that level\'s unlocked rules', () => {
    for (const lvl of CAMPAIGN_LEVELS) {
      const rules = rulesForLevel(levelIndexOf(lvl.id));
      for (const o of lvl.objectives) {
        const tag = `${lvl.id}: ${objectiveLabel(o)}`;
        if (o.kind === 'build' && o.tile !== undefined) {
          const entry = HOTBAR.find((a) => a.kind === 'place' && a.tile === o.tile);
          expect(entry, tag).toBeTruthy();
          expect(rules.hotbar, tag).toContain(entry!.label);
        }
        if (o.kind === 'upgrade') {
          const startTier = (o.what === 'pickaxe' ? lvl.start?.pickaxeTier : lvl.start?.swordTier) ?? 0;
          if (startTier < o.tier) {
            // Every tier step up to the target must be craftable
            for (let t = startTier + 1; t <= o.tier; t++) {
              const recipe = TIER_RECIPE[`${o.what}-${t}`];
              expect(rules.recipes, `${tag} (tier ${t})`).toContain(recipe);
            }
          }
        }
        if (o.kind === 'own') {
          const src = OWN_SOURCE[o.what];
          const granted = lvl.start?.[src.startFlag as keyof typeof lvl.start] === true;
          if (!granted) {
            const viaRecipe = src.recipe ? rules.recipes.includes(src.recipe) : false;
            const viaOffer = src.offer ? rules.shop.includes(src.offer) : false;
            expect(viaRecipe || viaOffer, tag).toBe(true);
          }
        }
        if (o.kind === 'depth' || o.kind === 'victory') {
          expect(rules.caves, tag).toBe(true);
        }
        if (o.kind === 'collect' && (o.material === 'crystal' || o.material === 'obsidian')) {
          expect(rules.caves, tag).toBe(true);
        }
        if (o.kind === 'fish') {
          expect(rules.recipes.includes('fishing_rod') || lvl.start?.hasRod === true, tag).toBe(true);
        }
        if (o.kind === 'kill' || o.kind === 'bossKill') {
          // There must actually be something to kill
          const totalZombies = lvl.nights.reduce((s, n) => s + n.target, 0);
          expect(totalZombies > 0 || rules.caves, tag).toBe(true);
        }
      }
    }
  });

  it('victory needs the Crystal Key — granted or craftable', () => {
    for (const lvl of CAMPAIGN_LEVELS) {
      if (!lvl.objectives.some((o) => o.kind === 'victory')) continue;
      const rules = rulesForLevel(levelIndexOf(lvl.id));
      expect(lvl.start?.hasCrystalKey === true || rules.recipes.includes('crystal_key')).toBe(true);
    }
  });

  it('graveyard levels generate enough crypts on their fixed seed', () => {
    for (const lvl of CAMPAIGN_LEVELS) {
      const goal = lvl.objectives.find((o) => o.kind === 'graveyards');
      if (!goal || goal.kind !== 'graveyards') continue;
      const world = generateWorld(lvl.seed, lvl.worldModifier);
      expect(findCrypts(world.tiles).length, lvl.id).toBeGreaterThanOrEqual(goal.count);
    }
  });

  it('gold-collect levels have gold ore on the map', () => {
    for (const lvl of CAMPAIGN_LEVELS) {
      const goal = lvl.objectives.find((o) => o.kind === 'collect' && o.material === 'gold');
      if (!goal) continue;
      const world = generateWorld(lvl.seed, lvl.worldModifier);
      let goldOre = 0;
      for (const row of world.tiles) for (const t of row) if (t.type === TileType.GoldOre) goldOre++;
      expect(goldOre, lvl.id).toBeGreaterThanOrEqual(3);
    }
  });
});

// --- Objective evaluation ------------------------------------------------------------

describe('objective evaluation', () => {
  it('computes progress for every objective kind', () => {
    const state = campaignState('w1-1');
    addItem(state.inventory, 'wood', 4);
    expect(objectiveProgress({ kind: 'collect', material: 'wood', count: 10 }, state)).toBe(4);
    state.stats.tilesMined = 7;
    expect(objectiveProgress({ kind: 'mine', count: 10 }, state)).toBe(7);
    state.stats.tilesPlaced = 5;
    expect(objectiveProgress({ kind: 'build', count: 9 }, state)).toBe(5);
    state.campaign!.counters.buildByTile[TileType.WallWood] = 2;
    expect(objectiveProgress({ kind: 'build', count: 6, tile: TileType.WallWood }, state)).toBe(2);
    state.stats.zombiesKilled = 11;
    expect(objectiveProgress({ kind: 'kill', count: 12 }, state)).toBe(11);
    state.campaign!.counters.killsByVariant.goblin = 3;
    expect(objectiveProgress({ kind: 'kill', count: 5, variant: 'goblin' }, state)).toBe(3);
    state.runMeta.bossKills = 1;
    expect(objectiveProgress({ kind: 'bossKill', count: 2 }, state)).toBe(1);
    state.nightNumber = 3; // startNight 1 → survived 2
    expect(objectiveProgress({ kind: 'survive', nights: 2 }, state)).toBe(2);
    state.pickaxeTier = 2;
    expect(objectiveProgress({ kind: 'upgrade', what: 'pickaxe', tier: 2, label: 'x' }, state)).toBe(1);
    expect(objectiveProgress({ kind: 'upgrade', what: 'sword', tier: 1, label: 'x' }, state)).toBe(0);
    state.hasBow = true;
    expect(objectiveProgress({ kind: 'own', what: 'bow', label: 'x' }, state)).toBe(1);
    state.runMeta.maxDepth = 2;
    expect(objectiveProgress({ kind: 'depth', depth: 3 }, state)).toBe(2);
    state.runMeta.graveyardsCleared = 1;
    expect(objectiveProgress({ kind: 'graveyards', count: 2 }, state)).toBe(1);
    state.campaign!.counters.fish = 2;
    expect(objectiveProgress({ kind: 'fish', count: 2 }, state)).toBe(2);
    expect(objectiveProgress({ kind: 'victory' }, state)).toBe(0);
    state.victory = true;
    expect(objectiveProgress({ kind: 'victory' }, state)).toBe(1);
  });

  it('latches done flags and reports newly completed objectives once', () => {
    const state = campaignState('w1-1'); // collect 10 wood + 6 stone
    let res = updateCampaignObjectives(state)!;
    expect(res.newlyDone).toEqual([]);
    expect(res.allDone).toBe(false);

    addItem(state.inventory, 'wood', 10);
    res = updateCampaignObjectives(state)!;
    expect(res.newlyDone).toHaveLength(1);
    expect((res.newlyDone[0] as CampaignObjectiveDef & { material: string }).material).toBe('wood');
    expect(res.allDone).toBe(false);

    // Spending the wood does NOT un-complete the latched objective
    removeItem(state.inventory, 'wood', 10);
    res = updateCampaignObjectives(state)!;
    expect(res.newlyDone).toEqual([]);
    expect(state.campaign!.objectives[0].done).toBe(true);

    addItem(state.inventory, 'stone', 6);
    res = updateCampaignObjectives(state)!;
    expect(res.newlyDone).toHaveLength(1);
    expect(res.allDone).toBe(true);
  });

  it('renders HUD lines with progress and checkmarks', () => {
    const state = campaignState('w1-1');
    addItem(state.inventory, 'wood', 10);
    updateCampaignObjectives(state);
    const lines = campaignObjectiveLines(state);
    expect(lines).toHaveLength(2);
    expect(lines[0].done).toBe(true);
    expect(lines[0].text).toContain('✅');
    expect(lines[1].done).toBe(false);
    expect(lines[1].text).toContain('0/6');
  });

  it('returns null without an active campaign', () => {
    const state = makeGameState();
    expect(updateCampaignObjectives(state)).toBeNull();
    expect(campaignObjectiveLines(state)).toEqual([]);
  });
});

// --- Night scripting -------------------------------------------------------------------

describe('night scripting', () => {
  it('follows the script and clamps to the last entry', () => {
    const state = campaignState('w1-3'); // nights: 10, then 14 swarm
    const camp = state.campaign!;
    expect(campaignNightPlan(camp, 1)!.target).toBe(10);
    expect(campaignNightPlan(camp, 2)!.target).toBe(14);
    expect(campaignNightPlan(camp, 2)!.twist).toBe('swarm');
    expect(campaignNightPlan(camp, 9)!.target).toBe(14); // clamped
  });

  it('respects startNight offsets', () => {
    const state = campaignState('w6-1'); // startNight 8, bosses scripted
    const camp = state.campaign!;
    expect(campaignNightPlan(camp, 8)!.boss).toBe('necromancer');
    expect(campaignNightPlan(camp, 9)!.boss).toBe('spiderQueen');
  });

  it('the spawn director honors force/off boss modes and exact targets', () => {
    const d = new SpawnDirector(() => 0.9);
    // Exact zero target: no zombies, immediately "all spawned"
    expect(d.beginNight(0, NIGHT_TWISTS.normal, 0, { exactTarget: true, bossMode: 'off' })).toBe(0);
    expect(d.allSpawned).toBe(true);
    let reqs = d.update(60000, { phase: 'night', nightNumber: 5, phaseElapsedMs: 60000, depth: 0 });
    expect(reqs).toEqual([]); // even on night 5, bossMode 'off' suppresses the boss

    // Forced boss on a non-5th night
    d.beginNight(3, NIGHT_TWISTS.normal, 0, { exactTarget: true, bossMode: 'force' });
    reqs = d.update(500, { phase: 'night', nightNumber: 2, phaseElapsedMs: 16000, depth: 0 });
    expect(reqs.some((r) => r.kind === 'boss')).toBe(true);

    // Default behavior unchanged: boss on 5th night only
    d.beginNight(20, NIGHT_TWISTS.normal);
    reqs = d.update(500, { phase: 'night', nightNumber: 5, phaseElapsedMs: 16000, depth: 0 });
    expect(reqs.some((r) => r.kind === 'boss')).toBe(true);
  });
});

// --- Gating ------------------------------------------------------------------------------

describe('campaign gating', () => {
  it('locks un-unlocked hotbar entries and the picker skips them', () => {
    const state = campaignState('w1-1'); // only Pick + Sword
    const pick = HOTBAR.findIndex((a) => a.label === 'Pick');
    const sword = HOTBAR.findIndex((a) => a.label === 'Sword');
    const bow = HOTBAR.findIndex((a) => a.label === 'Bow');
    const wallW = HOTBAR.findIndex((a) => a.label === 'Wall W');

    expect(hotbarCampaignLocked(pick, state)).toBe(false);
    expect(hotbarCampaignLocked(bow, state)).toBe(true);
    expect(hotbarCampaignLocked(wallW, state)).toBe(true);
    state.hasBow = true;
    addItem(state.inventory, 'arrow', 10);
    expect(hotbarAvailable(bow, state)).toBe(false); // campaign lock beats ownership

    // Wheel cycling only ever lands on unlocked tools
    const allowed = (s: number) => !hotbarCampaignLocked(s, state);
    let slot = pick;
    for (let i = 0; i < PRIMARY_HOTBAR_SLOTS.length; i++) {
      slot = cyclePrimaryHotbarSlot(slot, 1, allowed);
      expect([pick, sword]).toContain(slot);
    }

    // Build picker shows nothing on w1-1, and exactly the unlocked set later
    expect(buildPickerCells(state)).toHaveLength(0);
    const w13 = campaignState('w1-3');
    const labels = buildPickerCells(w13).map((c) => c.label);
    expect(labels.sort()).toEqual(['Door', 'Torch', 'Trap', 'Wall W'].sort());
  });

  it('classic runs are completely unaffected', () => {
    const state = makeGameState();
    expect(hotbarCampaignLocked(0, state)).toBe(false);
    expect(buildPickerCells(state).length).toBeGreaterThan(10);
    expect(campaignAllowsRecipe(state, 'storm_wand')).toBe(true);
    expect(campaignAllowsOffer(state, 'pistol')).toBe(true);
    expect(campaignShopClosed(state)).toBe(false);
    expect(campaignAllowsCaves(state)).toBe(true);
    expect(cyclePrimaryHotbarSlot(PRIMARY_HOTBAR_SLOTS[0], 1)).toBe(PRIMARY_HOTBAR_SLOTS[1]);
  });

  it('recipes, shop, and caves follow the level rules', () => {
    const w11 = campaignState('w1-1');
    expect(campaignAllowsRecipe(w11, 'stone_pickaxe')).toBe(false);
    expect(campaignShopClosed(w11)).toBe(true);
    expect(campaignAllowsCaves(w11)).toBe(false);

    const w21 = campaignState('w2-1');
    expect(campaignAllowsRecipe(w21, 'stone_pickaxe')).toBe(true);
    expect(campaignAllowsRecipe(w21, 'storm_wand')).toBe(false);
    expect(campaignShopClosed(w21)).toBe(true);

    const w31 = campaignState('w3-1');
    expect(campaignShopClosed(w31)).toBe(false);
    expect(campaignAllowsOffer(w31, 'pistol')).toBe(true);
    expect(campaignAllowsOffer(w31, 'lava_x1')).toBe(false);
    expect(campaignAllowsCaves(w31)).toBe(false);

    const w51 = campaignState('w5-1');
    expect(campaignAllowsCaves(w51)).toBe(true);
  });
});

// --- Scoring & store -----------------------------------------------------------------------

describe('stars and campaign store', () => {
  it('scores stars against par', () => {
    const lvl = levelById('w1-2')!; // parNights 1
    expect(starsForNights(lvl, 0)).toBe(3);
    expect(starsForNights(lvl, 1)).toBe(3);
    expect(starsForNights(lvl, 2)).toBe(2);
    expect(starsForNights(lvl, 3)).toBe(1);
  });

  it('persists completions; stars only improve, nights only shrink', () => {
    expect(CampaignStore.isCompleted('w1-1')).toBe(false);
    let res = CampaignStore.completeLevel('w1-1', 2, 3);
    expect(res.firstTime).toBe(true);
    expect(CampaignStore.starsFor('w1-1')).toBe(2);
    expect(CampaignStore.bestNightsFor('w1-1')).toBe(3);

    res = CampaignStore.completeLevel('w1-1', 1, 1); // worse stars, better time
    expect(res.firstTime).toBe(false);
    expect(res.improvedStars).toBe(false);
    expect(CampaignStore.starsFor('w1-1')).toBe(2);
    expect(CampaignStore.bestNightsFor('w1-1')).toBe(1);

    res = CampaignStore.completeLevel('w1-1', 3, 5);
    expect(res.improvedStars).toBe(true);
    expect(CampaignStore.starsFor('w1-1')).toBe(3);
    expect(CampaignStore.bestNightsFor('w1-1')).toBe(1);
  });

  it('unlocks levels strictly in order', () => {
    expect(CampaignStore.isUnlocked('w1-1')).toBe(true);
    expect(CampaignStore.isUnlocked('w1-2')).toBe(false);
    expect(CampaignStore.isUnlocked('w6-3')).toBe(false);
    CampaignStore.completeLevel('w1-1', 3, 0);
    expect(CampaignStore.isUnlocked('w1-2')).toBe(true);
    expect(CampaignStore.isUnlocked('w1-3')).toBe(false);
  });

  it('counts totals and campaign completion', () => {
    expect(CampaignStore.totalStars()).toBe(0);
    expect(CampaignStore.allCompleted()).toBe(false);
    for (const lvl of CAMPAIGN_LEVELS) CampaignStore.completeLevel(lvl.id, 3, lvl.parNights);
    expect(CampaignStore.completedCount()).toBe(18);
    expect(CampaignStore.totalStars()).toBe(54);
    expect(CampaignStore.allCompleted()).toBe(true);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('mine2d:campaign_v1', '{nope!!');
    expect(CampaignStore.totalStars()).toBe(0);
    expect(CampaignStore.isUnlocked('w1-1')).toBe(true);
  });
});

// --- Run-state plumbing ----------------------------------------------------------------------

describe('campaign run state', () => {
  it('makeCampaignRunState snapshots resolved rules and fresh counters', () => {
    const def: CampaignLevelDef = levelById('w4-3')!;
    const run = makeCampaignRunState(def);
    expect(run.levelId).toBe('w4-3');
    expect(run.startNight).toBe(def.startNight);
    expect(run.finished).toBe(false);
    expect(run.objectives).toHaveLength(def.objectives.length);
    expect(run.rules.hotbar).toContain('Wall R');
    expect(run.rules.hotbar).not.toContain('W Frz'); // world 5 toy
    expect(run.rules.caves).toBe(false);
    expect(run.counters.fish).toBe(0);
  });

  it('objective goals are positive and labels render', () => {
    for (const lvl of CAMPAIGN_LEVELS) {
      for (const o of lvl.objectives) {
        expect(objectiveGoal(o)).toBeGreaterThan(0);
        expect(objectiveLabel(o).length).toBeGreaterThan(3);
      }
    }
  });
});
