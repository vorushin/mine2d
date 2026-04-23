import Phaser from 'phaser';
import { REVEAL_EXPAND_DAYS, REVEAL_RING_TILES, REVEAL_TILE_INTERVAL_MS, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { World } from '../world/World';
import { Effects } from '../gfx/Effects';
import { GameState, RevealedBounds, isInBounds } from '../state/GameState';

const MIST_DEPTH = 45;
const MIST_COLOR = 0x14161c;
const MIST_ALPHA = 0.95;

export interface DynamicTerrainDeps {
  scene: Phaser.Scene;
  world: World;
  effects: Effects;
  state: GameState;
}

/**
 * Owns the mist barrier that gates the playable region, and the
 * schedule + animation that expands it outward over the course
 * of a run. All state lives on `GameState.revealedBounds`.
 */
export class DynamicTerrain {
  private deps: DynamicTerrainDeps;
  private mist: Phaser.GameObjects.Graphics;
  private pendingReveal: { x: number; y: number }[] = [];
  private revealTimerMs = 0;

  constructor(deps: DynamicTerrainDeps) {
    this.deps = deps;
    this.mist = deps.scene.add.graphics();
    this.mist.setDepth(MIST_DEPTH);
    deps.world.setRevealedPredicate((x, y) => isInBounds(deps.state.revealedBounds, x, y));
    this.redrawMist();
  }

  /** Called on the `dayStart` event. Maybe schedules a ring expansion. */
  onDayStart(): void {
    const state = this.deps.state;
    state.daysUntilNextExpansion = Math.max(0, state.daysUntilNextExpansion - 1);
    if (state.daysUntilNextExpansion <= 0 && !this.atMaxBounds(state.revealedBounds)) {
      state.daysUntilNextExpansion = REVEAL_EXPAND_DAYS;
      this.scheduleExpansion(REVEAL_RING_TILES);
    }
  }

  update(deltaMs: number): void {
    if (this.pendingReveal.length === 0) return;
    this.revealTimerMs -= deltaMs;
    while (this.revealTimerMs <= 0 && this.pendingReveal.length > 0) {
      const next = this.pendingReveal.shift()!;
      this.revealTile(next.x, next.y);
      this.revealTimerMs += REVEAL_TILE_INTERVAL_MS;
    }
    if (this.pendingReveal.length === 0) this.revealTimerMs = 0;
  }

  /** Finalize any in-progress reveal animation immediately (used before save). */
  flush(): void {
    while (this.pendingReveal.length > 0) {
      const p = this.pendingReveal.shift()!;
      this.revealTile(p.x, p.y, /* silent */ true);
    }
    this.revealTimerMs = 0;
    this.redrawMist();
  }

  private scheduleExpansion(ring: number): void {
    const prev = { ...this.deps.state.revealedBounds };
    const next = planExpansion(prev, WORLD_WIDTH, WORLD_HEIGHT, ring);
    // Widen bounds first so gameplay immediately recognises the new area as mineable.
    this.deps.state.revealedBounds = next;
    // Queue the ring tiles for the animated effect. Each "tile" is a cell in the newly-revealed band.
    const tiles: { x: number; y: number }[] = [];
    for (let y = next.yMin; y <= next.yMax; y++) {
      for (let x = next.xMin; x <= next.xMax; x++) {
        if (!isInBounds(prev, x, y)) tiles.push({ x, y });
      }
    }
    // Shuffle so the reveal doesn't look like a strict raster sweep
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    this.pendingReveal.push(...tiles);
    this.revealTimerMs = 0;
    // Fire the UI event at the start of the animation
    this.deps.scene.events.emit('terrain_revealed', next);
    // The mist is redrawn as each tile reveals — but we also redraw once now so the
    // (already-widened) bounds show in one pass rather than waiting out the queue.
    this.redrawMist();
  }

  private revealTile(x: number, y: number, silent = false): void {
    if (!silent) {
      const wc = this.deps.world.tileToWorldCenter(x, y);
      this.deps.effects.burst(wc.x, wc.y, 0xaabacc, 4, 60, 320, 0.7);
    }
    // Repainting the whole mist each tile is cheap (single Graphics draw) and
    // keeps the edge honest as bounds grow.
    this.redrawMist();
  }

  /** Paint every tile currently outside revealedBounds as opaque mist. */
  private redrawMist(): void {
    const b = this.deps.state.revealedBounds;
    this.mist.clear();
    this.mist.fillStyle(MIST_COLOR, MIST_ALPHA);
    // Top strip
    if (b.yMin > 0) {
      this.mist.fillRect(0, 0, WORLD_WIDTH * TILE_SIZE, b.yMin * TILE_SIZE);
    }
    // Bottom strip
    if (b.yMax < WORLD_HEIGHT - 1) {
      const y = (b.yMax + 1) * TILE_SIZE;
      this.mist.fillRect(0, y, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE - y);
    }
    // Left strip (only within the un-capped vertical range)
    if (b.xMin > 0) {
      this.mist.fillRect(0, b.yMin * TILE_SIZE, b.xMin * TILE_SIZE, (b.yMax - b.yMin + 1) * TILE_SIZE);
    }
    // Right strip
    if (b.xMax < WORLD_WIDTH - 1) {
      const x = (b.xMax + 1) * TILE_SIZE;
      this.mist.fillRect(x, b.yMin * TILE_SIZE, WORLD_WIDTH * TILE_SIZE - x, (b.yMax - b.yMin + 1) * TILE_SIZE);
    }
    // Soft stroked frontier to hint where the edge is
    this.mist.lineStyle(1, 0x88aaff, 0.4);
    this.mist.strokeRect(
      b.xMin * TILE_SIZE,
      b.yMin * TILE_SIZE,
      (b.xMax - b.xMin + 1) * TILE_SIZE,
      (b.yMax - b.yMin + 1) * TILE_SIZE,
    );
  }

  private atMaxBounds(b: RevealedBounds): boolean {
    return b.xMin <= 0 && b.yMin <= 0 && b.xMax >= WORLD_WIDTH - 1 && b.yMax >= WORLD_HEIGHT - 1;
  }
}

/** Pure function — grows bounds by `ring` on every side, clamped to world size. */
export function planExpansion(
  bounds: RevealedBounds,
  worldWidth: number,
  worldHeight: number,
  ring: number,
): RevealedBounds {
  return {
    xMin: Math.max(0, bounds.xMin - ring),
    yMin: Math.max(0, bounds.yMin - ring),
    xMax: Math.min(worldWidth - 1, bounds.xMax + ring),
    yMax: Math.min(worldHeight - 1, bounds.yMax + ring),
  };
}
