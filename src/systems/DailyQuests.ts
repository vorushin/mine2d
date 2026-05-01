import { DailyQuest, DailyQuestKind, GameState, addItem } from '../state/GameState';
import { MaterialId } from '../world/tileTypes';

export interface QuestCompletion {
  quest: DailyQuest;
  rewards: { material: MaterialId; count: number }[];
}

export function createDailyQuest(day: number): DailyQuest {
  if (day <= 1) {
    return {
      id: `day-${day}-first-cache`,
      day,
      title: 'Mine 6 trees or rocks',
      hint: 'Use the pickaxe to gather starter resources.',
      kind: 'mine',
      progress: 0,
      goal: 6,
      reward: [{ material: 'stone', count: 3 }, { material: 'gold', count: 1 }],
      completed: false,
    };
  }

  const tier = Math.max(0, day - 2);
  if (day % 3 === 2) {
    return {
      id: `day-${day}-builder`,
      day,
      title: `Build ${Math.min(6, 3 + Math.floor(tier / 3))} defenses`,
      hint: 'Walls, torches, bridges, and turrets all count.',
      kind: 'build',
      progress: 0,
      goal: Math.min(6, 3 + Math.floor(tier / 3)),
      reward: [{ material: 'arrow', count: 10 + tier * 2 }, { material: 'gold', count: 1 }],
      completed: false,
    };
  }

  if (day % 3 === 0) {
    return {
      id: `day-${day}-hunter`,
      day,
      title: `Defeat ${Math.min(24, 6 + day * 2)} zombies`,
      hint: 'Player kills, Rex kills, traps, and turrets all count.',
      kind: 'kill',
      progress: 0,
      goal: Math.min(24, 6 + day * 2),
      reward: [{ material: 'iron', count: 2 + Math.floor(day / 4) }, { material: 'gold', count: 2 }],
      completed: false,
    };
  }

  return {
    id: `day-${day}-prospector`,
    day,
    title: `Mine ${Math.min(18, 8 + day)} resources`,
    hint: 'Trees, stone, ore, crates, and event rocks all count.',
    kind: 'mine',
    progress: 0,
    goal: Math.min(18, 8 + day),
    reward: [{ material: 'wood', count: 4 }, { material: 'stone', count: 4 }, { material: 'gold', count: 1 }],
    completed: false,
  };
}

export function ensureDailyQuest(state: GameState): DailyQuest {
  if (!state.dailyQuest || state.dailyQuest.day !== state.nightNumber) {
    state.dailyQuest = createDailyQuest(state.nightNumber);
  }
  return state.dailyQuest;
}

export function recordQuestProgress(state: GameState, kind: DailyQuestKind, amount = 1): QuestCompletion | null {
  const quest = state.dailyQuest;
  if (!quest || quest.completed || quest.kind !== kind) return null;
  quest.progress = Math.min(quest.goal, quest.progress + amount);
  if (quest.progress < quest.goal) return null;

  quest.completed = true;
  const rewards = quest.reward.map((r) => ({ ...r }));
  for (const reward of rewards) addItem(state.inventory, reward.material, reward.count);
  return { quest, rewards };
}

export function questRewardLabel(quest: DailyQuest | { reward: DailyQuest['reward'] }): string {
  return quest.reward.map((r) => `+${r.count} ${r.material}`).join('  ');
}

export function questProgressLabel(quest: DailyQuest): string {
  const status = quest.completed ? 'complete' : `${quest.progress}/${quest.goal}`;
  return `${quest.title} (${status})`;
}
