import Phaser from 'phaser';
import { World } from '../world/World';
import { BOMB_FUSE_MS, BOMB_THROW_SPEED, PROJECTILE_SPEED, TILE_SIZE } from '../config';
import { TEX } from '../gfx/textures';

export type ProjectileOwner = 'player' | 'turret';
export type ProjectileKind = 'arrow' | 'bullet' | 'flame' | 'bomb';

export interface ProjectileSpawn {
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  owner: ProjectileOwner;
  kind: ProjectileKind;
  /** Optional per-kind overrides. */
  rangePx?: number; // flame: max distance before expiring
  onBombExplode?: (tx: number, ty: number) => void; // bomb: called when fuse hits 0
}

export class Projectile {
  readonly sprite: Phaser.GameObjects.Image;
  readonly damage: number;
  readonly owner: ProjectileOwner;
  readonly kind: ProjectileKind;
  /** For flame projectiles: how many more zombies this can pierce. */
  pierceBudget: number;
  private world: World;
  private vx: number;
  private vy: number;
  alive = true;
  private ttlMs: number;
  private maxRangePx = Infinity;
  private travelPx = 0;
  private onBombExplode?: (tx: number, ty: number) => void;

  constructor(scene: Phaser.Scene, world: World, spawn: ProjectileSpawn) {
    this.world = world;
    this.kind = spawn.kind;
    this.damage = spawn.damage;
    this.owner = spawn.owner;
    this.pierceBudget = spawn.kind === 'flame' ? 3 : 0;
    this.onBombExplode = spawn.onBombExplode;

    const tex =
      spawn.kind === 'arrow' ? TEX.arrow :
      spawn.kind === 'bullet' ? TEX.bullet :
      spawn.kind === 'flame' ? TEX.flame :
      TEX.bomb;
    this.sprite = scene.add.image(spawn.x, spawn.y, tex);
    this.sprite.setDepth(12);
    const mag = Math.hypot(spawn.dx, spawn.dy) || 1;
    const speed =
      spawn.kind === 'flame' ? PROJECTILE_SPEED * 0.85 :
      spawn.kind === 'bomb' ? BOMB_THROW_SPEED :
      PROJECTILE_SPEED;
    this.vx = (spawn.dx / mag) * speed;
    this.vy = (spawn.dy / mag) * speed;
    this.sprite.rotation = Math.atan2(this.vy, this.vx);

    if (spawn.kind === 'flame') {
      this.ttlMs = 800;
      this.maxRangePx = spawn.rangePx ?? TILE_SIZE * 3;
      this.sprite.setScale(1.4);
    } else if (spawn.kind === 'bomb') {
      this.ttlMs = BOMB_FUSE_MS;
    } else {
      this.ttlMs = 2000;
    }
  }

  update(deltaMs: number): void {
    if (!this.alive) return;
    const stepX = (this.vx * deltaMs) / 1000;
    const stepY = (this.vy * deltaMs) / 1000;
    this.sprite.x += stepX;
    this.sprite.y += stepY;
    this.travelPx += Math.hypot(stepX, stepY);

    if (this.kind === 'bomb') {
      // Air drag on the thrown bomb so it arcs short.
      this.vx *= Math.pow(0.88, deltaMs / 1000);
      this.vy *= Math.pow(0.88, deltaMs / 1000);
      this.sprite.rotation += (deltaMs / 1000) * 6;
    }

    this.ttlMs -= deltaMs;
    if (this.travelPx > this.maxRangePx) {
      this.destroy();
      return;
    }
    if (this.ttlMs <= 0) {
      if (this.kind === 'bomb' && this.onBombExplode) {
        const tp = this.world.worldToTile(this.sprite.x, this.sprite.y);
        this.onBombExplode(tp.x, tp.y);
      }
      this.destroy();
      return;
    }
    // Flame and bomb don't resolve tile collisions the same way arrows do.
    if (this.kind === 'bomb') return;
    const tp = this.world.worldToTile(this.sprite.x, this.sprite.y);
    if (this.world.blocksProjectile(tp.x, tp.y)) {
      if (this.kind === 'flame') {
        // Flame fizzles against walls, doesn't damage them meaningfully.
        this.destroy();
      } else {
        this.world.damageTile(tp.x, tp.y, Math.ceil(this.damage / 4));
        this.destroy();
      }
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
