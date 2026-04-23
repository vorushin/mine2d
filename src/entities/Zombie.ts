import Phaser from 'phaser';
import { World } from '../world/World';
import { Player } from './Player';
import { TILE_SIZE, COLORS, ZOMBIE_BASE_HP, ZOMBIE_BASE_DAMAGE, ZOMBIE_BASE_SPEED, BRUTE_CHANCE_BY_NIGHT } from '../config';
import { TileType, TILE_SPECS } from '../world/tileTypes';
import { bfsNextStep } from '../systems/Pathfinding';

export type ZombieVariant = 'normal' | 'fast' | 'armored' | 'brute' | 'boss';

export function bruteChanceForNight(night: number): number {
  const arr = BRUTE_CHANCE_BY_NIGHT;
  if (arr.length === 0) return 0;
  const idx = Math.max(0, night - 1);
  return arr[Math.min(idx, arr.length - 1)];
}

export interface ZombieSpec {
  variant: ZombieVariant;
  hp: number;
  damage: number;
  speed: number;
  tint: number;
}

export function specForNight(night: number): ZombieSpec {
  const armoredChance = night >= 8 ? 0.2 : night >= 5 ? 0.1 : 0;
  const fastChance = night >= 5 ? 0.3 : night >= 3 ? 0.15 : 0;
  const bruteChance = bruteChanceForNight(night);

  if (bruteChance > 0 && Math.random() < bruteChance) {
    return {
      variant: 'brute',
      hp: ZOMBIE_BASE_HP * 4.5,
      damage: ZOMBIE_BASE_DAMAGE * 2.2,
      speed: ZOMBIE_BASE_SPEED * 0.75,
      tint: 0xff8080,
    };
  }
  if (armoredChance > 0 && Math.random() < armoredChance) {
    return {
      variant: 'armored',
      hp: ZOMBIE_BASE_HP * 3,
      damage: ZOMBIE_BASE_DAMAGE * 1.6,
      speed: ZOMBIE_BASE_SPEED * 0.85,
      tint: 0x7a4a22,
    };
  }
  if (fastChance > 0 && Math.random() < fastChance) {
    return {
      variant: 'fast',
      hp: ZOMBIE_BASE_HP * 0.8,
      damage: ZOMBIE_BASE_DAMAGE,
      speed: ZOMBIE_BASE_SPEED * 1.6,
      tint: 0xa8d65c,
    };
  }
  const scale = 1 + (night - 1) * 0.1;
  return {
    variant: 'normal',
    hp: ZOMBIE_BASE_HP * scale,
    damage: ZOMBIE_BASE_DAMAGE * scale,
    speed: ZOMBIE_BASE_SPEED,
    tint: COLORS.zombie,
  };
}

/** Big boss zombie. Used once every 5 nights. */
export function specForBoss(night: number): ZombieSpec {
  const tier = Math.floor(night / 5);
  return {
    variant: 'boss',
    hp: ZOMBIE_BASE_HP * (6 + tier * 3),
    damage: ZOMBIE_BASE_DAMAGE * 2.2,
    speed: ZOMBIE_BASE_SPEED * 0.7,
    tint: 0x551010,
  };
}

export function generateZombieTextures(scene: Phaser.Scene): void {
  const variants: { key: string; body: number; head: number; eye: number; accent?: number; armored?: boolean }[] = [
    { key: 'zombie_normal', body: 0x3d7a3d, head: 0x2f5e2f, eye: 0xffdb3d },
    { key: 'zombie_fast', body: 0xa8d65c, head: 0x72a03b, eye: 0xff5050 },
    { key: 'zombie_armored', body: 0x6f4a22, head: 0x553716, eye: 0xff9030, accent: 0x8a8a8a, armored: true },
    { key: 'zombie_brute', body: 0x8a2030, head: 0x5a1018, eye: 0xffe030, accent: 0x2a2a2a, armored: true },
  ];

  for (const v of variants) {
    if (scene.textures.exists(v.key)) continue;
    const g = scene.add.graphics();
    const s = 22;
    g.fillStyle(v.body, 1);
    g.fillRect(4, 9, s - 8, 11);
    g.fillStyle(v.head, 1);
    g.fillRect(6, 2, s - 12, 8);
    g.fillStyle(v.body, 1);
    g.fillRect(0, 11, 4, 6);
    g.fillRect(s - 4, 11, 4, 6);
    g.fillRect(6, 20, 4, 5);
    g.fillRect(s - 10, 20, 4, 5);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(5, 24, 6, 2);
    g.fillRect(s - 11, 24, 6, 2);
    g.fillStyle(v.eye, 1);
    g.fillRect(8, 5, 2, 2);
    g.fillRect(s - 10, 5, 2, 2);
    g.fillStyle(0x8a1a1a, 1);
    g.fillRect(10, 8, 2, 1);
    g.lineStyle(1, 0x0a0a0a, 0.9);
    g.strokeRect(4, 9, s - 8, 11);
    g.strokeRect(6, 2, s - 12, 8);
    g.fillStyle(v.head, 1);
    g.fillRect(5, 16, s - 10, 1);
    if (v.armored && v.accent) {
      g.fillStyle(v.accent, 1);
      g.fillRect(6, 11, s - 12, 4);
      g.lineStyle(1, 0x000000, 0.8);
      g.strokeRect(6, 11, s - 12, 4);
    }
    g.generateTexture(v.key, s, 26);
    g.destroy();
  }

  // Boss zombie — bigger, crimson, with spikes
  if (!scene.textures.exists('zombie_boss')) {
    const g = scene.add.graphics();
    const s = 36;
    // body
    g.fillStyle(0x551010, 1); g.fillRect(6, 14, s - 12, 18);
    // head
    g.fillStyle(0x3a0a0a, 1); g.fillRect(9, 2, s - 18, 12);
    // arms
    g.fillStyle(0x551010, 1); g.fillRect(0, 16, 6, 10); g.fillRect(s - 6, 16, 6, 10);
    // legs
    g.fillRect(10, 32, 5, 4); g.fillRect(s - 15, 32, 5, 4);
    // feet
    g.fillStyle(0x1a0505, 1); g.fillRect(9, 35, 7, 3); g.fillRect(s - 16, 35, 7, 3);
    // eyes (menacing orange)
    g.fillStyle(0xff4020, 1); g.fillRect(13, 6, 3, 3); g.fillRect(s - 16, 6, 3, 3);
    g.fillStyle(0xffffaa, 1); g.fillRect(14, 7, 1, 1); g.fillRect(s - 15, 7, 1, 1);
    // mouth blood
    g.fillStyle(0x8a1a1a, 1); g.fillRect(15, 11, 6, 2);
    g.fillStyle(0x551010, 1); g.fillRect(16, 13, 2, 2); g.fillRect(20, 13, 2, 2);
    // spikes on shoulders
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(4, 12, 3, 3); g.fillRect(8, 10, 3, 3);
    g.fillRect(s - 7, 12, 3, 3); g.fillRect(s - 11, 10, 3, 3);
    // chestplate
    g.fillStyle(0x3a3a3a, 1); g.fillRect(10, 17, s - 20, 8);
    g.fillStyle(0x555555, 1); g.fillRect(10, 17, s - 20, 1);
    // outline
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(6, 14, s - 12, 18); g.strokeRect(9, 2, s - 18, 12);
    g.generateTexture('zombie_boss', s, 38);
    g.destroy();
  }
}

interface Target {
  kind: 'path' | 'wall';
  tx: number;
  ty: number;
  committedMs: number;
}

export class Zombie {
  readonly sprite: Phaser.GameObjects.Image;
  hp: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly speed: number;
  readonly variant: ZombieVariant;
  alive = true;
  private scene: Phaser.Scene;
  private world: World;
  private attackCooldownMs = 0;
  private walkPhase = Math.random() * Math.PI * 2;
  private repathCooldownMs = 0;
  private target: Target | null = null;
  private hpBarBg?: Phaser.GameObjects.Rectangle;
  private hpBarFg?: Phaser.GameObjects.Rectangle;
  private lavaBurnMs = 0;

  private shadow: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, world: World, worldX: number, worldY: number, spec: ZombieSpec) {
    this.scene = scene;
    this.world = world;
    const key =
      spec.variant === 'boss' ? 'zombie_boss' :
      spec.variant === 'fast' ? 'zombie_fast' :
      spec.variant === 'armored' ? 'zombie_armored' :
      spec.variant === 'brute' ? 'zombie_brute' :
      'zombie_normal';
    const shadowW =
      spec.variant === 'boss' ? 42 :
      spec.variant === 'brute' ? 32 :
      spec.variant === 'armored' ? 26 :
      spec.variant === 'fast' ? 20 : 22;
    const shadowOffY = spec.variant === 'boss' ? 18 : spec.variant === 'brute' ? 16 : 12;
    const shadowH = spec.variant === 'boss' ? 10 : spec.variant === 'brute' ? 8 : 6;
    const shadowA = spec.variant === 'boss' ? 0.45 : spec.variant === 'brute' ? 0.4 : 0.35;
    this.shadow = scene.add.ellipse(worldX, worldY + shadowOffY, shadowW, shadowH, 0x000000, shadowA);
    this.shadow.setDepth(8);
    this.sprite = scene.add.image(worldX, worldY, key);
    const scale =
      spec.variant === 'boss' ? 1.8 :
      spec.variant === 'brute' ? 1.9 :
      spec.variant === 'armored' ? 1.6 :
      spec.variant === 'fast' ? 1.25 : 1.4;
    this.sprite.setScale(scale);
    this.sprite.setDepth(9);
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.damage = spec.damage;
    this.speed = spec.speed;
    this.variant = spec.variant;
  }

  update(deltaMs: number, player: Player, neighbors: Zombie[]): void {
    if (!this.alive) return;
    if (this.attackCooldownMs > 0) this.attackCooldownMs -= deltaMs;
    if (this.repathCooldownMs > 0) this.repathCooldownMs -= deltaMs;
    if (this.target) this.target.committedMs -= deltaMs;

    // Lava damage to zombies (the zombie's tile type)
    const myTile = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const myT = this.world.getTileAt(myTile.x, myTile.y);
    if (myT?.type === TileType.Lava) {
      this.lavaBurnMs -= deltaMs;
      if (this.lavaBurnMs <= 0) {
        this.takeDamage(5);
        this.lavaBurnMs = 200;
      }
    }

    const selfTile = this.world.worldToTile(this.sprite.x, this.sprite.y);
    const playerTile = this.world.worldToTile(player.x, player.y);

    // In-range melee on player
    const dxP = player.x - this.sprite.x;
    const dyP = player.y - this.sprite.y;
    const distPx = Math.hypot(dxP, dyP);
    if (distPx <= TILE_SIZE * 0.7) {
      if (this.attackCooldownMs <= 0) {
        player.hurt(this.damage);
        this.attackCooldownMs = 700;
        this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.15, duration: 80, yoyo: true });
        this.scene.events.emit('zombie_hit_player', this.sprite.x, this.sprite.y);
      }
      return;
    }

    // Pathfind periodically
    if (!this.target || this.target.committedMs <= 0 || this.repathCooldownMs <= 0) {
      const next = bfsNextStep(this.world, selfTile, playerTile, true);
      if (next) {
        const nextTile = this.world.getTileAt(next.x, next.y);
        if (nextTile && !this.world.isWalkable(next.x, next.y)) {
          // Next step is a wall — commit to breaking it
          this.target = { kind: 'wall', tx: next.x, ty: next.y, committedMs: 1400 };
        } else {
          this.target = { kind: 'path', tx: next.x, ty: next.y, committedMs: 400 };
        }
      } else {
        this.target = null;
      }
      this.repathCooldownMs = 350 + Math.random() * 150;
    }

    if (!this.target) {
      // No path. Drift toward player directly.
      this.moveContinuous(dxP, dyP, 1, deltaMs, neighbors);
      return;
    }

    if (this.target.kind === 'wall') {
      const t = this.world.getTileAt(this.target.tx, this.target.ty);
      if (!t || this.world.isWalkable(this.target.tx, this.target.ty)) {
        this.target = null;
        return;
      }
      const target = this.world.tileToWorldCenter(this.target.tx, this.target.ty);
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= TILE_SIZE * 0.85) {
        // Within striking range — attack the wall
        if (this.attackCooldownMs <= 0) {
          const broke = this.world.damageTile(this.target.tx, this.target.ty, Math.ceil(this.damage / 1.6));
          this.attackCooldownMs = 550;
          this.scene.events.emit('zombie_hit_wall', target.x, target.y, t.type);
          if (broke) {
            this.scene.events.emit('wall_broken', this.target.tx, this.target.ty, t.type);
            this.target = null;
          }
        }
        // Slight bob in place
        this.walkPhase += deltaMs / 140;
        this.sprite.setRotation(Math.sin(this.walkPhase) * 0.12);
      } else {
        this.moveContinuous(dx, dy, 1, deltaMs, neighbors);
      }
    } else {
      const target = this.world.tileToWorldCenter(this.target.tx, this.target.ty);
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.target.committedMs = 0;
      } else {
        this.moveContinuous(dx, dy, 1, deltaMs, neighbors);
      }
    }
  }

  /**
   * Move with steering toward (dx, dy) + repulsion from neighbors so zombies don't clump.
   */
  private moveContinuous(dx: number, dy: number, desire: number, deltaMs: number, neighbors: Zombie[]): void {
    const mag = Math.hypot(dx, dy) || 1;
    let vx = (dx / mag) * desire;
    let vy = (dy / mag) * desire;

    // Separation: push away from neighbors that are too close
    const sepRadius = TILE_SIZE * 0.6;
    for (const other of neighbors) {
      if (other === this || !other.alive) continue;
      const odx = this.sprite.x - other.sprite.x;
      const ody = this.sprite.y - other.sprite.y;
      const od = Math.hypot(odx, ody);
      if (od > 0 && od < sepRadius) {
        const push = (sepRadius - od) / sepRadius;
        vx += (odx / od) * push * 0.75;
        vy += (ody / od) * push * 0.75;
      }
    }

    const m2 = Math.hypot(vx, vy) || 1;
    vx /= m2;
    vy /= m2;
    const step = (this.speed * deltaMs) / 1000;
    const nextX = this.sprite.x + vx * step;
    const nextY = this.sprite.y + vy * step;

    if (this.canStand(nextX, nextY)) {
      this.sprite.x = nextX;
      this.sprite.y = nextY;
    } else if (this.canStand(nextX, this.sprite.y)) {
      this.sprite.x = nextX;
    } else if (this.canStand(this.sprite.x, nextY)) {
      this.sprite.y = nextY;
    } else {
      // Totally blocked — try to damage the tile ahead (fallback)
      const probe = Math.abs(vx) > Math.abs(vy)
        ? this.world.worldToTile(nextX, this.sprite.y)
        : this.world.worldToTile(this.sprite.x, nextY);
      const t = this.world.getTileAt(probe.x, probe.y);
      if (t && !this.world.isWalkable(probe.x, probe.y) && t.type !== TileType.ShopNPC && this.attackCooldownMs <= 0) {
        this.world.damageTile(probe.x, probe.y, Math.ceil(this.damage / 1.6));
        this.attackCooldownMs = 550;
        this.scene.events.emit('zombie_hit_wall', probe.x * TILE_SIZE + TILE_SIZE / 2, probe.y * TILE_SIZE + TILE_SIZE / 2, t.type);
      }
    }

    this.sprite.setFlipX(vx < 0);
    this.walkPhase += (deltaMs / 1000) * (6 + this.speed / 40);
    const bob = Math.sin(this.walkPhase) * 1.5;
    this.sprite.setRotation(Math.sin(this.walkPhase) * 0.08);
    this.sprite.y += bob - (this.sprite.getData('lastBob') ?? 0);
    this.sprite.setData('lastBob', bob);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 12);
  }

  private canStand(wx: number, wy: number): boolean {
    const half = 7;
    const corners: [number, number][] = [
      [wx - half, wy - half],
      [wx + half, wy - half],
      [wx - half, wy + half],
      [wx + half, wy + half],
    ];
    for (const [cx, cy] of corners) {
      const tp = this.world.worldToTile(cx, cy);
      if (!this.world.isWalkable(tp.x, tp.y)) {
        // Lava is walkable — zombies that step on it will take damage (we apply below in take-effect)
        const tt = this.world.getTileAt(tp.x, tp.y);
        if (!tt || TILE_SPECS[tt.type].walkable === false) return false;
      }
    }
    return true;
  }

  distanceToPlayer(player: Player): number {
    return Math.hypot(player.x - this.sprite.x, player.y - this.sprite.y);
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.alive) this.sprite.clearTint();
    });
    this.showHpBar();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private showHpBar(): void {
    if (!this.hpBarBg) {
      this.hpBarBg = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 22, 24, 4, 0x000000, 0.7).setDepth(20);
      this.hpBarFg = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 22, 22, 2, 0xff4444, 1).setDepth(21);
    }
    const pct = Math.max(0, this.hp) / this.maxHp;
    this.hpBarBg!.setPosition(this.sprite.x, this.sprite.y - 22);
    this.hpBarFg!.setPosition(this.sprite.x - 11 + (22 * pct) / 2, this.sprite.y - 22);
    this.hpBarFg!.width = 22 * pct;
    this.hpBarFg!.fillColor = pct > 0.5 ? 0x44dd44 : pct > 0.2 ? 0xddcc33 : 0xff4444;
  }

  die(): void {
    this.alive = false;
    if (this.hpBarBg) this.hpBarBg.destroy();
    if (this.hpBarFg) this.hpBarFg.destroy();
    this.shadow.destroy();
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      angle: 180,
      duration: 240,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
