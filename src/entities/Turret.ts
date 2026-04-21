import Phaser from 'phaser';
import { World } from '../world/World';
import { Zombie } from './Zombie';
import { Projectile, ProjectileSpawn } from './Projectile';
import {
  TILE_SIZE,
  COLORS,
  TURRET_BASIC_DAMAGE,
  TURRET_BASIC_FIRE_MS,
  TURRET_BASIC_RANGE,
  TURRET_ADVANCED_DAMAGE,
  TURRET_ADVANCED_FIRE_MS,
  TURRET_ADVANCED_RANGE,
} from '../config';

export type TurretKind = 'basic' | 'advanced';

export interface TurretInstance {
  tileX: number;
  tileY: number;
  kind: TurretKind;
  cooldownMs: number;
  barrel: Phaser.GameObjects.Rectangle;
}

export function makeTurretBarrel(scene: Phaser.Scene, tileX: number, tileY: number, kind: TurretKind): Phaser.GameObjects.Rectangle {
  const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
  const cy = tileY * TILE_SIZE + TILE_SIZE / 2 - 6;
  const color = kind === 'basic' ? COLORS.turret_basic : COLORS.turret_advanced;
  const barrel = scene.add.rectangle(cx, cy, 5, TILE_SIZE * 0.5, color);
  barrel.setDepth(11);
  barrel.setStrokeStyle(1, 0x000000, 0.6);
  barrel.setOrigin(0.5, 1);
  return barrel;
}

export function turretRange(kind: TurretKind): number {
  return kind === 'basic' ? TURRET_BASIC_RANGE : TURRET_ADVANCED_RANGE;
}

export function turretFirePeriod(kind: TurretKind): number {
  return kind === 'basic' ? TURRET_BASIC_FIRE_MS : TURRET_ADVANCED_FIRE_MS;
}

export function turretDamage(kind: TurretKind): number {
  return kind === 'basic' ? TURRET_BASIC_DAMAGE : TURRET_ADVANCED_DAMAGE;
}

/**
 * For each alive turret, aim barrel at nearest zombie, fire if off cooldown.
 * Returns projectile spawn descriptors to be instantiated by the caller (keeps this module pure-ish).
 */
export function tickTurrets(
  turrets: TurretInstance[],
  zombies: Zombie[],
  world: World,
  deltaMs: number,
): ProjectileSpawn[] {
  void world;
  const spawns: ProjectileSpawn[] = [];
  for (const t of turrets) {
    t.cooldownMs -= deltaMs;
    const cx = t.tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = t.tileY * TILE_SIZE + TILE_SIZE / 2;
    const range = turretRange(t.kind);
    let nearest: Zombie | null = null;
    let nearestDist = Infinity;
    for (const z of zombies) {
      if (!z.alive) continue;
      const d = Math.hypot(z.sprite.x - cx, z.sprite.y - cy);
      if (d < range && d < nearestDist) {
        nearest = z;
        nearestDist = d;
      }
    }
    if (nearest) {
      t.barrel.rotation = Math.atan2(nearest.sprite.y - cy, nearest.sprite.x - cx) + Math.PI / 2;
      if (t.cooldownMs <= 0) {
        t.cooldownMs = turretFirePeriod(t.kind);
        const aim = Projectile.aimVector({ x: cx, y: cy }, { x: nearest.sprite.x, y: nearest.sprite.y });
        spawns.push({
          x: cx + aim.dx * TILE_SIZE * 0.6,
          y: cy + aim.dy * TILE_SIZE * 0.6,
          dx: aim.dx,
          dy: aim.dy,
          damage: turretDamage(t.kind),
          owner: 'turret',
          kind: t.kind === 'basic' ? 'arrow' : 'bullet',
        });
      }
    }
  }
  return spawns;
}
