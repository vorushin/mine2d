/**
 * Campaign progress across sessions: stars and best times per level, stored in
 * localStorage (same defensive-read conventions as MetaStore).
 */

import { CAMPAIGN_LEVELS } from './Campaign';

export interface CampaignLevelResult {
  stars: number;
  /** Fewest nights the level has been beaten in. */
  bestNights: number;
}

interface CampaignSave {
  levels: Record<string, CampaignLevelResult>;
}

const CAMPAIGN_KEY = 'mine2d:campaign_v1';

function readSave(): CampaignSave {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return { levels: {} };
    const parsed = JSON.parse(raw) as Partial<CampaignSave>;
    const levels: Record<string, CampaignLevelResult> = {};
    if (parsed.levels && typeof parsed.levels === 'object') {
      for (const [id, r] of Object.entries(parsed.levels)) {
        if (!r || typeof r !== 'object') continue;
        const stars = Math.min(3, Math.max(1, Math.floor((r as CampaignLevelResult).stars ?? 1)));
        const bestNights = Math.max(0, Math.floor((r as CampaignLevelResult).bestNights ?? 0));
        if (Number.isFinite(stars) && Number.isFinite(bestNights)) levels[id] = { stars, bestNights };
      }
    }
    return { levels };
  } catch {
    return { levels: {} };
  }
}

function writeSave(save: CampaignSave): void {
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(save)); } catch { /* private mode etc. */ }
}

export interface CompleteLevelResult {
  firstTime: boolean;
  improvedStars: boolean;
}

export const CampaignStore = {
  isCompleted(id: string): boolean {
    return id in readSave().levels;
  },

  starsFor(id: string): number {
    return readSave().levels[id]?.stars ?? 0;
  },

  bestNightsFor(id: string): number | null {
    return readSave().levels[id]?.bestNights ?? null;
  },

  /** Record a completion; stars only ever improve, bestNights only ever shrinks. */
  completeLevel(id: string, stars: number, nights: number): CompleteLevelResult {
    const save = readSave();
    const prev = save.levels[id];
    const clamped = Math.min(3, Math.max(1, Math.floor(stars)));
    const next: CampaignLevelResult = prev
      ? { stars: Math.max(prev.stars, clamped), bestNights: Math.min(prev.bestNights, Math.max(0, nights)) }
      : { stars: clamped, bestNights: Math.max(0, nights) };
    save.levels[id] = next;
    writeSave(save);
    return { firstTime: !prev, improvedStars: !!prev && next.stars > prev.stars };
  },

  /** A level is playable when it's the first, or the one before it is done. */
  isUnlocked(id: string): boolean {
    const idx = CAMPAIGN_LEVELS.findIndex((l) => l.id === id);
    if (idx < 0) return false;
    if (idx === 0) return true;
    return this.isCompleted(CAMPAIGN_LEVELS[idx - 1].id);
  },

  completedCount(): number {
    const save = readSave().levels;
    return CAMPAIGN_LEVELS.filter((l) => l.id in save).length;
  },

  totalStars(): number {
    const save = readSave().levels;
    return CAMPAIGN_LEVELS.reduce((sum, l) => sum + (save[l.id]?.stars ?? 0), 0);
  },

  allCompleted(): boolean {
    return this.completedCount() >= CAMPAIGN_LEVELS.length;
  },
};
