import { GameState } from '../state/GameState';

export interface Achievement {
  id: string;
  label: string;
  description: string;
  unlocked: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_blood',
    label: 'First Blood',
    description: 'Kill your first zombie.',
    unlocked: (s) => s.stats.zombiesKilled >= 1,
  },
  {
    id: 'zombie_slayer',
    label: 'Zombie Slayer',
    description: 'Kill 50 zombies in one run.',
    unlocked: (s) => s.stats.zombiesKilled >= 50,
  },
  {
    id: 'horde_hunter',
    label: 'Horde Hunter',
    description: 'Kill 150 zombies in one run.',
    unlocked: (s) => s.stats.zombiesKilled >= 150,
  },
  {
    id: 'miner',
    label: 'Miner',
    description: 'Mine 25 tiles.',
    unlocked: (s) => s.stats.tilesMined >= 25,
  },
  {
    id: 'architect',
    label: 'Architect',
    description: 'Build 30 tiles.',
    unlocked: (s) => s.stats.tilesPlaced >= 30,
  },
  {
    id: 'survivor_3',
    label: 'Survivor III',
    description: 'Survive until night 3.',
    unlocked: (s) => s.nightNumber >= 3,
  },
  {
    id: 'survivor_5',
    label: 'Survivor V',
    description: 'Survive until night 5.',
    unlocked: (s) => s.nightNumber >= 5,
  },
  {
    id: 'rich',
    label: 'Scrooge',
    description: 'Earn 25 gold.',
    unlocked: (s) => s.stats.goldEarned >= 25,
  },
  {
    id: 'tooled_up',
    label: 'Tooled Up',
    description: 'Craft an iron pickaxe.',
    unlocked: (s) => s.pickaxeTier >= 2,
  },
  {
    id: 'armed',
    label: 'Armed and Ready',
    description: 'Own a pistol.',
    unlocked: (s) => s.hasPistol,
  },
];

export function earnedAchievements(state: GameState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.unlocked(state));
}
