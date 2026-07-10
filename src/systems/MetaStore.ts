/**
 * Permanent progression across runs: Star Coins and unlocks, stored in
 * localStorage. Every run banks coins when it ends; coins buy companions,
 * classes, and world modifiers in the Hero's Hut.
 *
 * (CompanionId lives here — not in entities/Companion — so pure modules can
 * reference it without pulling Phaser into the import graph.)
 */

export type CompanionId = 'rex' | 'whiskers' | 'ember' | 'bolt';
export type ClassId = 'adventurer' | 'knight' | 'ranger' | 'engineer' | 'miner';
export type ModifierId = 'winter' | 'island' | 'lava';

export interface Meta {
  coins: number;
  companions: CompanionId[];
  classes: ClassId[];
  modifiers: ModifierId[];
  victories: number;
}

export interface RunSummaryForCoins {
  nights: number;
  bossKills: number;
  maxDepth: number;
  graveyardsCleared: number;
  victory: boolean;
}

export function starCoinsForRun(r: RunSummaryForCoins): number {
  return Math.max(
    0,
    r.nights * 2 + r.bossKills * 5 + r.maxDepth * 3 + r.graveyardsCleared * 2 + (r.victory ? 25 : 0),
  );
}

export type UnlockKind = 'companion' | 'class' | 'modifier';

export const UNLOCK_PRICES: {
  companions: Record<Exclude<CompanionId, 'rex'>, number>;
  classes: Record<Exclude<ClassId, 'adventurer'>, number>;
  modifiers: Record<ModifierId, number>;
} = {
  companions: { whiskers: 30, ember: 60, bolt: 90 },
  classes: { knight: 40, ranger: 40, engineer: 40, miner: 40 },
  modifiers: { winter: 50, island: 50, lava: 50 },
};

const META_KEY = 'mine2d:meta_v1';

function defaultMeta(): Meta {
  return { coins: 0, companions: ['rex'], classes: ['adventurer'], modifiers: [], victories: 0 };
}

function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<Meta>;
    const base = defaultMeta();
    return {
      coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? Math.floor(parsed.coins) : 0,
      companions: Array.isArray(parsed.companions)
        ? Array.from(new Set(['rex', ...parsed.companions.filter((c): c is CompanionId => typeof c === 'string')]))
        : base.companions,
      classes: Array.isArray(parsed.classes)
        ? Array.from(new Set(['adventurer', ...parsed.classes.filter((c): c is ClassId => typeof c === 'string')]))
        : base.classes,
      modifiers: Array.isArray(parsed.modifiers)
        ? parsed.modifiers.filter((m): m is ModifierId => m === 'winter' || m === 'island' || m === 'lava')
        : [],
      victories: typeof parsed.victories === 'number' && parsed.victories >= 0 ? Math.floor(parsed.victories) : 0,
    };
  } catch {
    return defaultMeta();
  }
}

function writeMeta(meta: Meta): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* private mode etc. */ }
}

export function priceOf(kind: UnlockKind, id: string): number {
  if (kind === 'companion') return (UNLOCK_PRICES.companions as Record<string, number>)[id] ?? 0;
  if (kind === 'class') return (UNLOCK_PRICES.classes as Record<string, number>)[id] ?? 0;
  return (UNLOCK_PRICES.modifiers as Record<string, number>)[id] ?? 0;
}

export const MetaStore = {
  get(): Meta {
    return readMeta();
  },

  addCoins(n: number): Meta {
    const meta = readMeta();
    meta.coins = Math.max(0, meta.coins + Math.floor(n));
    writeMeta(meta);
    return meta;
  },

  recordVictory(): Meta {
    const meta = readMeta();
    meta.victories += 1;
    writeMeta(meta);
    return meta;
  },

  isUnlocked(kind: UnlockKind, id: string): boolean {
    const meta = readMeta();
    if (kind === 'companion') return (meta.companions as string[]).includes(id);
    if (kind === 'class') return (meta.classes as string[]).includes(id);
    return (meta.modifiers as string[]).includes(id);
  },

  /** Spend coins to unlock. Returns false if already owned or unaffordable. */
  unlock(kind: UnlockKind, id: string): boolean {
    if (this.isUnlocked(kind, id)) return false;
    const price = priceOf(kind, id);
    const meta = readMeta();
    if (price <= 0 || meta.coins < price) return false;
    meta.coins -= price;
    if (kind === 'companion') meta.companions.push(id as CompanionId);
    else if (kind === 'class') meta.classes.push(id as ClassId);
    else meta.modifiers.push(id as ModifierId);
    writeMeta(meta);
    return true;
  },
};
