import { describe, expect, it } from 'vitest';
import { makeGameState } from '../src/state/GameState';
import { createDailyQuest, ensureDailyQuest, recordQuestProgress } from '../src/systems/DailyQuests';

describe('DailyQuests', () => {
  it('creates a starter gathering quest for day one', () => {
    const quest = createDailyQuest(1);
    expect(quest.kind).toBe('mine');
    expect(quest.goal).toBe(6);
    expect(quest.completed).toBe(false);
    expect(quest.reward.length).toBeGreaterThan(0);
  });

  it('records progress and pays rewards once', () => {
    const state = makeGameState();
    state.dailyQuest = {
      id: 'test',
      day: 1,
      title: 'Mine 2 tiles',
      hint: '',
      kind: 'mine',
      progress: 0,
      goal: 2,
      reward: [{ material: 'gold', count: 3 }],
      completed: false,
    };

    expect(recordQuestProgress(state, 'build')).toBeNull();
    expect(recordQuestProgress(state, 'mine')).toBeNull();
    expect(state.dailyQuest.progress).toBe(1);
    expect(state.inventory.counts.gold).toBeUndefined();

    const done = recordQuestProgress(state, 'mine');
    expect(done?.quest.completed).toBe(true);
    expect(state.inventory.counts.gold).toBe(3);

    expect(recordQuestProgress(state, 'mine')).toBeNull();
    expect(state.inventory.counts.gold).toBe(3);
  });

  it('keeps the current quest for the same day and rotates on a new day', () => {
    const state = makeGameState();
    const first = ensureDailyQuest(state);
    expect(ensureDailyQuest(state)).toBe(first);

    state.nightNumber = 2;
    const second = ensureDailyQuest(state);
    expect(second).not.toBe(first);
    expect(second.day).toBe(2);
  });
});
