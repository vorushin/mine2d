import Phaser from 'phaser';
import { World } from '../world/World';
import { TEX } from '../gfx/textures';

/**
 * Friendly wandering chicken. Roams randomly, flees briefly if approached,
 * gets spooked and despawns if hit (leaving a food pickup). Cosmetic + tiny reward.
 */
export class Chicken {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  alive = true;
  hp = 8;
  private scene: Phaser.Scene;
  private world: World;
  private vx = 0;
  private vy = 0;
  private idleMs = 0;
  private fleeMs = 0;
  private clucksMs = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    this.scene = scene;
    this.world = world;
    this.shadow = scene.add.ellipse(x, y + 6, 12, 3, 0x000000, 0.3).setDepth(8);
    this.sprite = scene.add.image(x, y, TEX.chicken);
    this.sprite.setScale(1.1);
    this.sprite.setDepth(9);
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    if (!this.alive) return;

    this.clucksMs -= deltaMs;
    if (this.clucksMs <= 0) {
      this.clucksMs = 4000 + Math.random() * 8000;
      // tiny idle bob
      this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 2, yoyo: true, duration: 180 });
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

  die(): void {
    this.alive = false;
    this.shadow.destroy();
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, scaleX: 0.4, scaleY: 0.4, duration: 180,
      onComplete: () => this.sprite.destroy(),
    });
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
