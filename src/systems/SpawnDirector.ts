import { NightTwist, modifiedNightTarget } from './NightTwists';
import { GameState } from '../state/GameState';

/**
 * Decides WHEN enemies appear; the scene decides WHAT they look like and
 * places them. Owns night-siege pacing, boss scheduling, and (underground)
 * ambient cave-spawn pressure. Pure timing logic — no Phaser.
 */

export interface SpawnRequest {
  kind: 'zombie' | 'boss' | 'cave';
}

const BOSS_DELAY_MS = 15000;

export class SpawnDirector {
  private nightTarget = 0;
  private nightSpawned = 0;
  private spawnTimerMs = 0;
  private bossSpawned = false;
  private caveTimerMs = 0;
  private rand: () => number;

  constructor(rand: () => number = Math.random) {
    this.rand = rand;
  }

  /** Returns the twist-adjusted zombie target for the night. */
  beginNight(baseTarget: number, twist: NightTwist, graveyardBonus = 0): number {
    this.nightTarget = modifiedNightTarget(baseTarget, twist) + graveyardBonus;
    this.nightSpawned = 0;
    this.spawnTimerMs = 0;
    this.bossSpawned = false;
    return this.nightTarget;
  }

  get target(): number {
    return this.nightTarget;
  }

  get allSpawned(): boolean {
    return this.nightSpawned >= this.nightTarget;
  }

  /**
   * Surface siege pacing. Call every frame; returns spawn requests to fulfil.
   * No surface spawns happen while the player is underground — the horde is
   * down there with them (see updateCave).
   */
  update(deltaMs: number, state: Pick<GameState, 'phase' | 'nightNumber' | 'phaseElapsedMs' | 'depth'>): SpawnRequest[] {
    const requests: SpawnRequest[] = [];
    if (state.phase !== 'night' || state.depth > 0) return requests;

    if (this.nightSpawned < this.nightTarget) {
      this.spawnTimerMs -= deltaMs;
      if (this.spawnTimerMs <= 0) {
        // Mini-wave: occasionally a small group
        const wave = this.rand() < 0.35 ? 2 + Math.floor(this.rand() * 2) : 1;
        const n = Math.min(wave, this.nightTarget - this.nightSpawned);
        for (let i = 0; i < n; i++) {
          requests.push({ kind: 'zombie' });
          this.nightSpawned += 1;
        }
        // Pacing: faster on later nights so the target actually spawns in time
        this.spawnTimerMs = Math.max(450, 2600 - Math.min(2200, state.nightNumber * 140));
      }
    }

    if (!this.bossSpawned && state.nightNumber % 5 === 0 && state.phaseElapsedMs > BOSS_DELAY_MS) {
      this.bossSpawned = true;
      requests.push({ kind: 'boss' });
    }

    return requests;
  }

  /**
   * Ambient cave pressure while the player is underground. Denser at night
   * and on deeper floors. `alive` caps the swarm so caves stay fair.
   */
  updateCave(deltaMs: number, floor: number, phase: GameState['phase'], alive: number): SpawnRequest[] {
    const requests: SpawnRequest[] = [];
    if (floor <= 0) return requests;
    const cap = 8 + floor * 4;
    if (alive >= cap) return requests;
    this.caveTimerMs -= deltaMs;
    if (this.caveTimerMs <= 0) {
      const nightMult = phase === 'night' || phase === 'dusk' ? 0.62 : 1;
      const base = 6000 * nightMult / (1 + 0.3 * (floor - 1));
      this.caveTimerMs = base * (0.7 + this.rand() * 0.6);
      requests.push({ kind: 'cave' });
    }
    return requests;
  }
}
