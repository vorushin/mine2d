import Phaser from 'phaser';
import { World } from '../world/World';
import { TEX } from '../gfx/textures';
import { Zombie } from './Zombie';

const PECK_RANGE_PX = 3 * 32;
const PECK_COOLDOWN_MS = 1500;
const PECK_DAMAGE = 2;
export const CHICKEN_ARMY_MAX = 3;

/**
 * Friendly wandering chicken. Roams randomly and flees briefly if approached.
 * The rare golden variant gives gold when caught — and regular chickens can
 * be RECRUITED (tap them) into your chicken army: they follow you into
 * battle and peck at zombies.
 */
export class Chicken {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly golden: boolean;
  alive = true;
  hp = 8;
  recruited = false;
  private bandana?: Phaser.GameObjects.Rectangle;
  private peckCooldownMs = 0;
  private scene: Phaser.Scene;
  private world: World;
  private vx = 0;
  private vy = 0;
  private idleMs = 0;
  private fleeMs = 0;
  private clucksMs = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number, golden = false) {
    this.scene = scene;
    this.world = world;
    this.golden = golden;
    this.shadow = scene.add.ellipse(x, y + 6, 12, 3, 0x000000, 0.3).setDepth(8);
    this.sprite = scene.add.image(x, y, TEX.chicken);
    this.sprite.setScale(golden ? 1.3 : 1.1);
    this.sprite.setDepth(9);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => {
      if (this.alive && !this.golden) scene.events.emit('chicken_tapped', this);
    });
    if (golden) {
      this.sprite.setTint(0xffd700);
      scene.tweens.add({ targets: this.sprite, scale: this.sprite.scale * 1.08, yoyo: true, repeat: -1, duration: 500 });
    }
  }

  /** Join the chicken army: red bandana, fearless heart. */
  recruit(): void {
    if (this.recruited || this.golden) return;
    this.recruited = true;
    this.bandana = this.scene.add.rectangle(this.sprite.x, this.sprite.y - 4, 8, 3, 0xd03030).setDepth(9.5);
    this.scene.tweens.add({ targets: this.sprite, angle: 360, duration: 350 });
  }

  /** Chickens stay on the surface — hidden & frozen while the player is underground. */
  setHidden(hidden: boolean): void {
    this.sprite.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
    this.bandana?.setVisible(!hidden);
  }

  get hidden(): boolean {
    return !this.sprite.visible;
  }

  update(deltaMs: number, playerX: number, playerY: number, zombies: Zombie[] = []): void {
    if (!this.alive || this.hidden) return;

    this.clucksMs -= deltaMs;
    if (this.clucksMs <= 0) {
      this.clucksMs = 4000 + Math.random() * 8000;
      // tiny idle bob
      this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 2, yoyo: true, duration: 180 });
    }

    if (this.recruited) {
      this.updateRecruited(deltaMs, playerX, playerY, zombies);
      return;
    }

    // Flee if player too close
    const dx = this.sprite.x - playerX;
    const dy = this.sprite.y - playerY;
    const d = Math.hypot(dx, dy);
    if (d < 40 && this.fleeMs <= 0) {
      this.fleeMs = 1200;
      const mag = Math.max(0.01, d);
      this.vx = (dx / mag) * 1.4;
      this.vy = (dy / mag) * 1.4;
    }

    if (this.fleeMs > 0) {
      this.fleeMs -= deltaMs;
    } else {
      this.idleMs -= deltaMs;
      if (this.idleMs <= 0) {
        this.idleMs = 800 + Math.random() * 1200;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() < 0.4 ? 0 : 0.6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
      }
    }

    const step = (40 * deltaMs) / 1000;
    const nx = this.sprite.x + this.vx * step;
    const ny = this.sprite.y + this.vy * step;
    if (this.canStand(nx, ny)) {
      this.sprite.x = nx;
      this.sprite.y = ny;
    } else {
      this.vx = -this.vx;
      this.vy = -this.vy;
    }
    if (this.vx < -0.05) this.sprite.setFlipX(true);
    else if (this.vx > 0.05) this.sprite.setFlipX(false);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 7);
  }

  /** Army mode: follow the player, peck the nearest zombie in range. */
  private updateRecruited(deltaMs: number, playerX: number, playerY: number, zombies: Zombie[]): void {
    if (this.peckCooldownMs > 0) this.peckCooldownMs -= deltaMs;

    let target: Zombie | null = null;
    let tdist = PECK_RANGE_PX;
    for (const z of zombies) {
      if (!z.alive) continue;
      const d = Math.hypot(z.sprite.x - this.sprite.x, z.sprite.y - this.sprite.y);
      if (d < tdist) { target = z; tdist = d; }
    }

    let tx = this.sprite.x;
    let ty = this.sprite.y;
    if (target) {
      tx = target.sprite.x;
      ty = target.sprite.y;
      if (tdist < 20 && this.peckCooldownMs <= 0) {
        this.peckCooldownMs = PECK_COOLDOWN_MS;
        this.scene.tweens.add({ targets: this.sprite, scaleX: this.sprite.scaleX * 1.25, duration: 70, yoyo: true });
        this.scene.events.emit('chicken_peck', target, PECK_DAMAGE, this.sprite.x, this.sprite.y);
      }
    } else {
      const fromPlayer = Math.hypot(playerX - this.sprite.x, playerY - this.sprite.y);
      if (fromPlayer > 56) {
        tx = playerX + (Math.random() - 0.5) * 20;
        ty = playerY + 10;
      }
    }

    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 3) {
      const step = (78 * deltaMs) / 1000;
      const nx = this.sprite.x + (dx / dist) * step;
      const ny = this.sprite.y + (dy / dist) * step;
      if (this.canStand(nx, ny)) {
        this.sprite.x = nx;
        this.sprite.y = ny;
      }
      this.sprite.setFlipX(dx < 0);
    }
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 7);
    this.bandana?.setPosition(this.sprite.x, this.sprite.y - 4);
  }

  private canStand(wx: number, wy: number): boolean {
    const tp = this.world.worldToTile(wx, wy);
    return this.world.isWalkable(tp.x, tp.y);
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.sprite.setTint(0xffaaaa);
    this.scene.time.delayedCall(60, () => this.alive && this.sprite.clearTint());
    this.fleeMs = 1500;
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  scareFrom(wx: number, wy: number): void {
    const dx = this.sprite.x - wx;
    const dy = this.sprite.y - wy;
    const mag = Math.max(0.01, Math.hypot(dx, dy));
    this.fleeMs = 1500;
    this.vx = (dx / mag) * 1.8;
    this.vy = (dy / mag) * 1.8;
    this.scene.tweens.add({ targets: this.sprite, scale: this.sprite.scale * 1.1, yoyo: true, duration: 90 });
  }

  capture(): void {
    if (!this.alive) return;
    this.alive = false;
    this.bandana?.destroy();
    this.shadow.destroy();
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, y: this.sprite.y - 18, scaleX: 0.25, scaleY: 0.25, duration: 220,
      onComplete: () => this.sprite.destroy(),
    });
  }

  die(): void {
    this.alive = false;
    this.bandana?.destroy();
    this.shadow.destroy();
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, scaleX: 0.4, scaleY: 0.4, duration: 180,
      onComplete: () => this.sprite.destroy(),
    });
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
