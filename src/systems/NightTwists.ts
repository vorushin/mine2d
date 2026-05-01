export type NightTwistKind = 'normal' | 'swarm' | 'treasure' | 'runners' | 'goblins';

export interface NightTwist {
  kind: NightTwistKind;
  label: string;
  subtitle: string;
  targetMultiplier: number;
  lootMultiplier: number;
  runnerChance: number;
  goblinChance: number;
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
};

export function chooseNightTwist(night: number, rand = Math.random): NightTwist {
  if (night <= 1 || night % 5 === 0) return NIGHT_TWISTS.normal;
  const roll = rand();
  if (night >= 3 && roll < 0.2) return NIGHT_TWISTS.goblins;
  if (night >= 4 && roll < 0.4) return NIGHT_TWISTS.runners;
  if (roll < 0.62) return NIGHT_TWISTS.swarm;
  if (roll < 0.82) return NIGHT_TWISTS.treasure;
  return NIGHT_TWISTS.normal;
}

export function modifiedNightTarget(baseTarget: number, twist: NightTwist): number {
  return Math.max(1, Math.ceil(baseTarget * twist.targetMultiplier));
}
