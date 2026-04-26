import Phaser from 'phaser';

export interface ThumbstickValue {
  x: number;
  y: number;
  active: boolean;
}

export interface ThumbstickOptions {
  baseX: number;
  baseY: number;
  radius?: number;
  baseAlpha?: number;
  thumbAlpha?: number;
}

/**
 * Fixed-position thumb pad. The base circle is always painted at
 * (baseX, baseY); a touch only activates the pad if it begins inside the
 * base circle. Emits a normalized vector in [-1, 1] via the `value` field
 * while held, plus events:
 *   - 'press'   (x, y)         pad activated
 *   - 'change'  (x, y)         vector updated
 *   - 'release' (x, y)         pad released; (x, y) is the last value
 *     before it returned to (0, 0).
 */
export class Thumbstick {
  readonly events = new Phaser.Events.EventEmitter();
  readonly value: ThumbstickValue = { x: 0, y: 0, active: false };

  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private baseX: number;
  private baseY: number;
  private radius: number;
  private activePointerId: number | null = null;

  constructor(scene: Phaser.Scene, opts: ThumbstickOptions) {
    this.baseX = opts.baseX;
    this.baseY = opts.baseY;
    this.radius = opts.radius ?? 60;
    this.base = scene.add.circle(this.baseX, this.baseY, this.radius, 0xffffff, opts.baseAlpha ?? 0.08)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0)
      .setDepth(1000);
    this.thumb = scene.add.circle(this.baseX, this.baseY, this.radius * 0.45, 0xffffff, opts.thumbAlpha ?? 0.18)
      .setScrollFactor(0)
      .setDepth(1001);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== null) return;
      const dx = p.x - this.baseX;
      const dy = p.y - this.baseY;
      if (Math.hypot(dx, dy) > this.radius) return;
      this.activePointerId = p.id;
      this.value.active = true;
      this.updateFromPointer(p);
      this.events.emit('press', this.value.x, this.value.y);
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== p.id) return;
      this.updateFromPointer(p);
      this.events.emit('change', this.value.x, this.value.y);
    });

    const release = (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== p.id) return;
      const lastX = this.value.x;
      const lastY = this.value.y;
      this.activePointerId = null;
      this.value.x = 0;
      this.value.y = 0;
      this.value.active = false;
      this.thumb.setPosition(this.baseX, this.baseY);
      this.events.emit('release', lastX, lastY);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  private updateFromPointer(p: Phaser.Input.Pointer): void {
    const dx = p.x - this.baseX;
    const dy = p.y - this.baseY;
    const mag = Math.hypot(dx, dy);
    const cap = Math.min(mag, this.radius);
    const nx = mag === 0 ? 0 : (dx / mag) * cap;
    const ny = mag === 0 ? 0 : (dy / mag) * cap;
    this.thumb.setPosition(this.baseX + nx, this.baseY + ny);
    this.value.x = nx / this.radius;
    this.value.y = ny / this.radius;
  }

  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.base.setPosition(x, y);
    if (!this.value.active) this.thumb.setPosition(x, y);
  }

  destroy(): void {
    this.events.removeAllListeners();
    this.base.destroy();
    this.thumb.destroy();
  }
}
