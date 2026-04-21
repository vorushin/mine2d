import { TinyEmitter } from '../util/TinyEvents';
import { GameState } from '../state/GameState';
import {
  DAY_DURATION_MS,
  NIGHT_DURATION_MS,
  DUSK_DURATION_MS,
  DAWN_DURATION_MS,
  ZOMBIE_BASE_SPAWN_PER_NIGHT,
  ZOMBIE_SPAWN_RAMP_PER_NIGHT,
} from '../config';

export class DayNightCycle {
  readonly events = new TinyEmitter();
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  tick(deltaMs: number): void {
    this.state.phaseElapsedMs += deltaMs;
    const current = this.state.phase;
    const threshold = this.phaseDuration(current);
    if (this.state.phaseElapsedMs >= threshold) {
      this.state.phaseElapsedMs -= threshold;
      this.advance();
    }
  }

  /** Skip from day straight to dusk (player-triggered early night). */
  skipToNight(): void {
    if (this.state.phase === 'day') {
      this.state.phaseElapsedMs = 0;
      this.state.phase = 'dusk';
      this.events.emit('phase_changed', this.state.phase);
    }
  }

  private advance(): void {
    const order: GameState['phase'][] = ['day', 'dusk', 'night', 'dawn'];
    const idx = order.indexOf(this.state.phase);
    const next = order[(idx + 1) % order.length];
    this.state.phase = next;
    if (next === 'night') {
      this.events.emit('night_started', this.state.nightNumber, this.zombiesForNight(this.state.nightNumber));
    }
    if (next === 'dawn') {
      this.events.emit('dawn');
    }
    if (next === 'day' && idx === 3) {
      // we just wrapped from dawn -> day; new day means next night number
      this.state.nightNumber += 1;
      this.state.score = this.state.nightNumber - 1;
    }
    this.events.emit('phase_changed', next);
  }

  phaseDuration(phase: GameState['phase']): number {
    switch (phase) {
      case 'day':
        return DAY_DURATION_MS;
      case 'dusk':
        return DUSK_DURATION_MS;
      case 'night':
        return NIGHT_DURATION_MS;
      case 'dawn':
        return DAWN_DURATION_MS;
    }
  }

  phaseProgress(): number {
    return Math.min(1, this.state.phaseElapsedMs / this.phaseDuration(this.state.phase));
  }

  zombiesForNight(n: number): number {
    return ZOMBIE_BASE_SPAWN_PER_NIGHT + (n - 1) * ZOMBIE_SPAWN_RAMP_PER_NIGHT;
  }
}
