export type NightTwistKind = 'normal' | 'swarm' | 'treasure' | 'runners' | 'goblins' | 'fog' | 'meteors' | 'frost';

export interface NightTwist {
  kind: NightTwistKind;
  label: string;
  subtitle: string;
  targetMultiplier: number;
  lootMultiplier: number;
  runnerChance: number;
  goblinChance: number;
  /** Fog Night: darker, light pools shrink. */
  fog?: boolean;
  /** Meteor Night: the sky falls during the siege. */
  nightMeteors?: boolean;
  /** Frost Night: enemy stat multipliers. */
  enemySpeedMult?: number;
  enemyHpMult?: number;
}

export const NIGHT_TWISTS: Record<NightTwistKind, NightTwist> = {
  normal: {
    kind: 'normal',
    label: 'Normal Night',
    subtitle: 'Standard zombie pressure.',
    targetMultiplier: 1,
    lootMultiplier: 1,
    runnerChance: 0,
    goblinChance: 0,
  },
  swarm: {
    kind: 'swarm',
    label: 'Swarm Night',
    subtitle: 'More zombies, more chaos.',
    targetMultiplier: 1.35,
    lootMultiplier: 1.15,
    runnerChance: 0,
    goblinChance: 0,
  },
  treasure: {
    kind: 'treasure',
    label: 'Treasure Night',
    subtitle: 'Zombies carry extra loot.',
    targetMultiplier: 1,
    lootMultiplier: 1.8,
    runnerChance: 0,
    goblinChance: 0,
  },
  runners: {
    kind: 'runners',
    label: 'Runner Night',
    subtitle: 'More fast zombies. Keep moving.',
    targetMultiplier: 1.1,
    lootMultiplier: 1.2,
    runnerChance: 0.45,
    goblinChance: 0,
  },
  goblins: {
    kind: 'goblins',
    label: 'Goblin Raid',
    subtitle: 'Fast little thieves carry bonus loot.',
    targetMultiplier: 1.15,
    lootMultiplier: 1.25,
    runnerChance: 0,
    goblinChance: 0.55,
  },
  fog: {
    kind: 'fog',
    label: 'Fog Night',
    subtitle: 'Lights are dim. Stay near your torches.',
    targetMultiplier: 1,
    lootMultiplier: 1.3,
    runnerChance: 0,
    goblinChance: 0,
    fog: true,
  },
  meteors: {
    kind: 'meteors',
    label: 'Meteor Night',
    subtitle: 'The sky is falling — on them too!',
    targetMultiplier: 0.9,
    lootMultiplier: 1.4,
    runnerChance: 0,
    goblinChance: 0,
    nightMeteors: true,
  },
  frost: {
    kind: 'frost',
    label: 'Frost Night',
    subtitle: 'Slow, frozen, extra tough.',
    targetMultiplier: 1,
    lootMultiplier: 1.25,
    runnerChance: 0,
    goblinChance: 0,
    enemySpeedMult: 0.7,
    enemyHpMult: 1.3,
  },
};

export function chooseNightTwist(night: number, rand = Math.random): NightTwist {
  if (night <= 1 || night % 5 === 0) return NIGHT_TWISTS.normal;
  const roll = rand();
  if (night >= 3 && roll < 0.16) return NIGHT_TWISTS.goblins;
  if (night >= 4 && roll < 0.3) return NIGHT_TWISTS.runners;
  if (night >= 4 && roll < 0.4) return NIGHT_TWISTS.fog;
  if (night >= 4 && roll < 0.48) return NIGHT_TWISTS.meteors;
  if (night >= 5 && roll < 0.56) return NIGHT_TWISTS.frost;
  if (roll < 0.7) return NIGHT_TWISTS.swarm;
  if (roll < 0.86) return NIGHT_TWISTS.treasure;
  return NIGHT_TWISTS.normal;
}

export function modifiedNightTarget(baseTarget: number, twist: NightTwist): number {
  return Math.max(1, Math.ceil(baseTarget * twist.targetMultiplier));
}
