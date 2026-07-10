import { ZombieSpec } from '../entities/Zombie';
import { ZOMBIE_BASE_HP, ZOMBIE_BASE_DAMAGE, ZOMBIE_BASE_SPEED } from '../config';

/**
 * Blood-moon boss rotation + the Zombie King. Pure data & math — the scene
 * runs the actual fights.
 */

export type BossKind = 'necromancer' | 'spiderQueen' | 'golem' | 'king';

/** Every 5th night: necromancer → spider queen → golem → repeat, scaled. */
export function bossKindForNight(night: number): Exclude<BossKind, 'king'> {
  const idx = Math.max(0, Math.floor(night / 5) - 1) % 3;
  return (['necromancer', 'spiderQueen', 'golem'] as const)[idx];
}

export interface BossIntro {
  title: string;
  tip: string;
}

export const BOSS_INTROS: Record<BossKind, BossIntro> = {
  necromancer: {
    title: '☠ THE NECROMANCER',
    tip: 'He re-raises the fallen — hit him to break his ritual!',
  },
  spiderQueen: {
    title: '🕷 THE SPIDER QUEEN',
    tip: 'Her webs slow you. Squash the spiderlings!',
  },
  golem: {
    title: '🗿 THE STONE GOLEM',
    tip: 'Arrows bounce off — use sword, bombs, spikes, or lava!',
  },
  king: {
    title: '👑 THE ZOMBIE KING',
    tip: 'End this. For the surface!',
  },
};

export function specForBossKind(kind: Exclude<BossKind, 'king'>, night: number): ZombieSpec & { bossKind: BossKind } {
  const tier = Math.floor(night / 5); // 1 on night 5, 2 on night 10…
  const base: ZombieSpec = {
    variant: 'boss',
    hp: ZOMBIE_BASE_HP * (6 + tier * 3),
    damage: ZOMBIE_BASE_DAMAGE * 2.2,
    speed: ZOMBIE_BASE_SPEED * 0.7,
    tint: 0xffffff,
  };
  switch (kind) {
    case 'necromancer':
      return { ...base, bossKind: kind, hp: base.hp * 0.9, speed: ZOMBIE_BASE_SPEED * 0.62 };
    case 'spiderQueen':
      return { ...base, bossKind: kind, hp: base.hp * 1.05, speed: ZOMBIE_BASE_SPEED * 0.8, layWebs: true };
    case 'golem':
      return {
        ...base,
        bossKind: kind,
        hp: base.hp * 1.25,
        damage: ZOMBIE_BASE_DAMAGE * 2.8,
        speed: ZOMBIE_BASE_SPEED * 0.55,
        projectileResistant: true,
      };
  }
}

// --- The Zombie King ---------------------------------------------------------

export function kingSpec(night: number): ZombieSpec & { bossKind: BossKind } {
  return {
    variant: 'king',
    bossKind: 'king',
    hp: ZOMBIE_BASE_HP * (40 + night * 1.5),
    damage: ZOMBIE_BASE_DAMAGE * 2.6,
    speed: ZOMBIE_BASE_SPEED * 0.62,
    tint: 0xffffff,
  };
}

export function kingPhase(hpPct: number): 1 | 2 | 3 {
  if (hpPct > 0.5) return 1;
  if (hpPct > 0.25) return 2;
  return 3;
}

export interface KingPhaseTuning {
  summonEveryMs: number;
  summonCount: number;
  speedMult: number;
  /** Wall-damage multiplier — phase 2+ smashes through defenses. */
  wallDamageMult: number;
}

export const KING_PHASES: Record<1 | 2 | 3, KingPhaseTuning> = {
  1: { summonEveryMs: 9000, summonCount: 2, speedMult: 1, wallDamageMult: 1 },
  2: { summonEveryMs: 7000, summonCount: 3, speedMult: 1.5, wallDamageMult: 4 },
  3: { summonEveryMs: 5000, summonCount: 4, speedMult: 1.8, wallDamageMult: 6 },
};

// --- Necromancer ritual ------------------------------------------------------

export const NECRO_CHANNEL_EVERY_MS = 12000;
export const NECRO_CHANNEL_DURATION_MS = 2500;
export const NECRO_RAISE_COUNT = 3;
export const NECRO_RAISED_HP_FACTOR = 0.6;

export interface FallenRecord {
  x: number;
  y: number;
  raised: boolean;
}

/** Pick up to `count` un-raised fallen, mark them raised, and return them. */
export function pickFallenToRaise(fallen: FallenRecord[], count: number): FallenRecord[] {
  const out: FallenRecord[] = [];
  for (const f of fallen) {
    if (out.length >= count) break;
    if (f.raised) continue;
    f.raised = true;
    out.push(f);
  }
  return out;
}

// --- Spider Queen ------------------------------------------------------------

export const QUEEN_SPAWN_EVERY_MS = 9000;
export const QUEEN_SPIDERLING_COUNT = 2;

// --- Shared ------------------------------------------------------------------

export const BOSS_SOUL_DROP = 1;
export const GATE_HINT = 'Sealed… craft a Crystal Key (2 souls + 3 crystal)';
