import Phaser from 'phaser';
import { World } from '../world/World';
import { PROJECTILE_SPEED, TILE_SIZE } from '../config';
import { TEX } from '../gfx/textures';

export type ProjectileOwner = 'player' | 'turret';

export interface ProjectileSpawn {
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  owner: ProjectileOwner;
  kind: 'arrow' | 'bullet';
}

export class Projectile {
  readonly sprite: Phaser.GameObjects.Image;
  readonly damage: number;
  readonly owner: ProjectileOwner;
  readonly kind: 'arrow' | 'bullet';
  private world: World;
  private vx: number;
  private vy: number;
  alive = true;
  private ttlMs = 2000;

  constructor(scene: Phaser.Scene, world: World, spawn: ProjectileSpawn) {
    this.world = world;
    this.kind = spawn.kind;
    this.sprite = scene.add.image(spawn.x, spawn.y, spawn.kind === 'arrow' ? TEX.arrow : TEX.bullet);
    this.sprite.setDepth(12);
    const mag = Math.hypot(spawn.dx, spawn.dy) || 1;
    this.vx = (spawn.dx / mag) * PROJECTILE_SPEED;
    this.vy = (spawn.dy / mag) * PROJECTILE_SPEED;
    this.sprite.rotation = Math.atan2(this.vy, this.vx);
    this.damage = spawn.damage;
    this.owner = spawn.owner;
  }

  update(deltaMs: number): void {
    if (!this.alive) return;
    this.sprite.x += (this.vx * deltaMs) / 1000;
    this.sprite.y += (this.vy * deltaMs) / 1000;
    this.ttlMs -= deltaMs;
    if (this.ttlMs <= 0) {
      this.destroy();
      return;
    }
    const tp = this.world.worldToTile(this.sprite.x, this.sprite.y);
    if (this.world.blocksProjectile(tp.x, tp.y)) {
      // Projectile damages the blocker if it's a wall/door/ore — mostly harmless for walls, satisfying
      this.world.damageTile(tp.x, tp.y, Math.ceil(this.damage / 4));
      this.destroy();
    }
  }

  hitBox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 4, this.sprite.y - 4, 8, 8);
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
  }

  /** quick aim helper using world coordinates */
  static aimVector(from: { x: number; y: number }, to: { x: number; y: number }): { dx: number; dy: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const mag = Math.hypot(dx, dy) || 1;
    return { dx: dx / mag, dy: dy / mag };
  }
}

export const PROJECTILE_HIT_RADIUS = TILE_SIZE * 0.5;
