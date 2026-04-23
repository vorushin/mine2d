import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH, TILE_SIZE } from '../config';
import { World } from '../world/World';
import { TileType } from '../world/tileTypes';
import { Effects } from '../gfx/Effects';
import { Pickup } from '../entities/Pickup';
import { MaterialId } from '../world/tileTypes';
import { TEX } from '../gfx/textures';
import { sounds } from './Sound';

export interface WorldEventsDeps {
  scene: Phaser.Scene;
  world: World;
  effects: Effects;
  onPickup: (p: Pickup) => void;
  playerTilePos: () => { x: number; y: number };
  nightNumber: () => number;
}

interface Meteor {
  tx: number;
  ty: number;
  remainingMs: number;
  warning: Phaser.GameObjects.Arc;
}

interface VolcanoState {
  tx: number;
  ty: number;
  growthTimerMs: number;
}

/**
 * Dynamic world-event system. Each dawn it decides what to spawn (meteors,
 * a volcano) based on the current night number. During the day those events
 * play out: meteors land, the volcano spreads lava toward adjacent tiles.
 */
export class WorldEvents {
  private deps: WorldEventsDeps;
  private meteors: Meteor[] = [];
  private volcano: VolcanoState | null = null;
  private scheduleTimerMs = 0;
  private active = true;

  constructor(deps: WorldEventsDeps) {
    this.deps = deps;
    // Scan the world for a pre-placed volcano (world-gen may seed one)
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (deps.world.tiles[y][x].type === TileType.Volcano) {
          this.volcano = { tx: x, ty: y, growthTimerMs: 10000 };
          break;
        }
      }
      if (this.volcano) break;
    }
  }

  /** Called when a new day begins (after dawn). */
  onDayStart(): void {
    const night = this.deps.nightNumber();
    // Meteor strikes from day 2
    if (night >= 2) {
      const count = night >= 10 ? 3 : night >= 6 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.scheduleMeteor(3000 + i * 6000);
      }
    }

    // Volcano grows a bit faster as nights escalate (speed it up on harder nights)
    if (this.volcano) {
      this.volcano.growthTimerMs = Math.min(this.volcano.growthTimerMs, 12000 - Math.min(8000, night * 600));
    }
  }

  update(deltaMs: number): void {
    if (!this.active) return;

    // Meteor countdowns
    for (const m of this.meteors) {
      m.remainingMs -= deltaMs;
      // Pulse the warning circle
      m.warning.setScale(1 + Math.sin((m.remainingMs / 120)) * 0.15);
      if (m.remainingMs <= 0) this.landMeteor(m);
    }
    this.meteors = this.meteors.filter((m) => m.remainingMs > 0);

    // Volcano growth — speeds up as nights pass
    if (this.volcano) {
      const t = this.deps.world.getTileAt(this.volcano.tx, this.volcano.ty);
      if (!t || t.type !== TileType.Volcano) {
        this.volcano = null;
      } else {
        this.volcano.growthTimerMs -= deltaMs;
        if (this.volcano.growthTimerMs <= 0) {
          const night = this.deps.nightNumber();
          // Start slow (13s) so day 1 feels safe; get down to ~4s by night 10
          const interval = Math.max(4000, 13000 - (night - 1) * 900);
          this.volcano.growthTimerMs = interval + Math.random() * 2000;
          this.spreadLava();
        }
      }
    }

    // Schedule additional meteors mid-day on harder nights (rare)
    this.scheduleTimerMs += deltaMs;
    if (this.scheduleTimerMs > 30000 && this.deps.nightNumber() >= 8) {
      this.scheduleTimerMs = 0;
      if (Math.random() < 0.3) this.scheduleMeteor(1500);
    }
  }

  private scheduleMeteor(delayMs: number): void {
    // Pick a random tile not too close to the player
    const player = this.deps.playerTilePos();
    for (let tries = 0; tries < 40; tries++) {
      const tx = 3 + Math.floor(Math.random() * (WORLD_WIDTH - 6));
      const ty = 3 + Math.floor(Math.random() * (WORLD_HEIGHT - 6));
      const tile = this.deps.world.getTileAt(tx, ty);
      if (!tile) continue;
      if (tile.type === TileType.Water || tile.type === TileType.ShopNPC) continue;
      const d = Math.hypot(tx - player.x, ty - player.y);
      if (d < 4) continue;
      this.queueMeteor(tx, ty, delayMs);
      return;
    }
  }

  private queueMeteor(tx: number, ty: number, delayMs: number): void {
    const wc = this.deps.world.tileToWorldCenter(tx, ty);
    const warning = this.deps.scene.add.circle(wc.x, wc.y, 16, 0xff2020, 0.25);
    warning.setStrokeStyle(3, 0xff4040, 0.9);
    warning.setDepth(50);
    this.deps.scene.tweens.add({
      targets: warning, scale: 2.4, yoyo: true, repeat: -1, duration: 400,
    });
    this.meteors.push({ tx, ty, remainingMs: delayMs, warning });
  }

  private landMeteor(m: Meteor): void {
    m.warning.destroy();
    const wc = this.deps.world.tileToWorldCenter(m.tx, m.ty);

    // Meteor sprite falls from above
    const meteor = this.deps.scene.add.image(wc.x, wc.y - 300, TEX.meteor);
    meteor.setDepth(60);
    meteor.setScale(1.4);
    this.deps.scene.tweens.add({
      targets: meteor,
      y: wc.y,
      duration: 260,
      onComplete: () => {
        meteor.destroy();
        this.impactAt(m.tx, m.ty, wc.x, wc.y);
      },
    });
  }

  private impactAt(tx: number, ty: number, wx: number, wy: number): void {
    this.deps.scene.cameras.main.shake(240, 0.008);
    this.deps.effects.burst(wx, wy, 0xff4d1a, 40, 240, 1000, 2.2);
    this.deps.effects.burst(wx, wy, 0xffcc66, 24, 180, 800, 1.8);
    sounds.bossRoar();
    // Destroy tiles within radius 2 → crater ground
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.hypot(dx, dy) > 2.3) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        const tile = this.deps.world.getTileAt(nx, ny);
        if (!tile) continue;
        if (tile.type === TileType.ShopNPC) continue;
        // Leave the impact tile as crater ground
        if (dx === 0 && dy === 0) {
          tile.type = TileType.Crater;
          tile.hp = 0;
          // Redraw the crater ground — replace existing ground image by swapping texture on top
          this.deps.world.forceRedrawGround(nx, ny);
        } else {
          this.deps.world.damageTile(nx, ny, 9999);
        }
      }
    }
    // Spawn loot — iron and stone are common, gold occasional
    const loot: { m: MaterialId; c: number }[] = [
      { m: 'iron', c: 3 }, { m: 'stone', c: 4 }, { m: 'gold', c: 1 },
    ];
    for (const l of loot) {
      this.deps.onPickup(new Pickup(this.deps.scene, wx + (Math.random() - 0.5) * 24, wy + (Math.random() - 0.5) * 24, l.m, l.c));
    }
  }

  private spreadLava(): void {
    if (!this.volcano) return;
    // Flood-fill radius: find existing volcano/lava tiles and pick a random adjacent non-lava tile to convert.
    const lavaTiles: { x: number; y: number }[] = [{ x: this.volcano.tx, y: this.volcano.ty }];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (this.deps.world.tiles[y][x].type === TileType.Lava) lavaTiles.push({ x, y });
      }
    }
    // Shuffle + pick the first with a spreadable neighbor
    for (let i = lavaTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lavaTiles[i], lavaTiles[j]] = [lavaTiles[j], lavaTiles[i]];
    }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const src of lavaTiles) {
      for (let k = dirs.length - 1; k > 0; k--) {
        const m = Math.floor(Math.random() * (k + 1));
        [dirs[k], dirs[m]] = [dirs[m], dirs[k]];
      }
      for (const [dx, dy] of dirs) {
        const nx = src.x + dx;
        const ny = src.y + dy;
        const t = this.deps.world.getTileAt(nx, ny);
        if (!t) continue;
        if (t.type === TileType.Grass || t.type === TileType.Dirt || t.type === TileType.Sand || t.type === TileType.FlowerField) {
          this.deps.world.placeTile(nx, ny, TileType.Lava);
          // Little puff
          const wc = this.deps.world.tileToWorldCenter(nx, ny);
          this.deps.effects.burst(wc.x, wc.y, 0xff6030, 6, 60, 300, 0.8);
          return;
        }
      }
    }
  }

  get volcanoPos(): { x: number; y: number } | null {
    return this.volcano ? { x: this.volcano.tx, y: this.volcano.ty } : null;
  }
}

void TILE_SIZE;
