import Phaser from 'phaser';
import { TEX } from './textures';

/**
 * Thin wrapper around Phaser 3 particle emitter. One shared emitter per color-intent
 * would be possible, but we spawn small ephemeral bursts directly — the burst count
 * is low enough that allocation is a non-issue.
 */
export class Effects {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  burst(x: number, y: number, color: number, count = 8, speed = 90, lifetime = 400, scale = 1): void {
    const emitter = this.scene.add.particles(x, y, TEX.particle, {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      lifespan: { min: lifetime * 0.5, max: lifetime },
      scale: { start: 1.2 * scale, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 80,
      quantity: count,
      tint: color,
      emitting: false,
    });
    emitter.setDepth(15);
    emitter.explode(count);
    this.scene.time.delayedCall(lifetime + 200, () => emitter.destroy());
  }

  bloodBurst(x: number, y: number, color = 0x8a1a1a): void {
    this.burst(x, y, color, 10, 120, 420, 1);
  }

  bloodExplode(x: number, y: number, color = 0x8a1a1a): void {
    this.burst(x, y, color, 22, 180, 640, 1.4);
  }

  wallDebris(x: number, y: number, color: number): void {
    this.burst(x, y, color, 6, 80, 380, 1);
  }

  miningDust(x: number, y: number, color: number): void {
    this.burst(x, y, color, 4, 60, 280, 0.8);
  }

  shotMuzzle(x: number, y: number, dx: number, dy: number): void {
    const mag = Math.hypot(dx, dy) || 1;
    const nx = dx / mag;
    const ny = dy / mag;
    const emitter = this.scene.add.particles(x + nx * 6, y + ny * 6, TEX.particle, {
      speed: { min: 20, max: 60 },
      angle: { min: Math.atan2(ny, nx) * (180 / Math.PI) - 15, max: Math.atan2(ny, nx) * (180 / Math.PI) + 15 },
      lifespan: 160,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffeea0, 0xffaa33],
      quantity: 4,
      emitting: false,
    });
    emitter.setDepth(15);
    emitter.explode(4);
    this.scene.time.delayedCall(300, () => emitter.destroy());
  }
}
