import Phaser from 'phaser';

export interface JoystickState {
  x: number;
  y: number;
  active: boolean;
}

/**
 * On-screen virtual joystick for touch input. Positions itself on first touch within the left half of the screen
 * and follows up to a radius, emitting normalized x/y in [-1, 1].
 */
export class VirtualJoystick {
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private radius: number;
  readonly value: JoystickState = { x: 0, y: 0, active: false };
  private activePointerId: number | null = null;

  constructor(scene: Phaser.Scene, radius = 60) {
    this.radius = radius;
    this.base = scene.add.circle(0, 0, radius, 0xffffff, 0.08);
    this.thumb = scene.add.circle(0, 0, radius * 0.45, 0xffffff, 0.18);
    this.base.setVisible(false);
    this.thumb.setVisible(false);
    this.base.setScrollFactor(0);
    this.thumb.setScrollFactor(0);
    this.base.setDepth(1000);
    this.thumb.setDepth(1001);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== null) return;
      if (p.x > scene.scale.width / 2) return; // left half only
      this.activePointerId = p.id;
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.thumb.setPosition(p.x, p.y).setVisible(true);
      this.value.active = true;
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== p.id) return;
      const dx = p.x - this.base.x;
      const dy = p.y - this.base.y;
      const mag = Math.hypot(dx, dy);
      const cap = Math.min(mag, this.radius);
      const nx = (dx / (mag || 1)) * cap;
      const ny = (dy / (mag || 1)) * cap;
      this.thumb.setPosition(this.base.x + nx, this.base.y + ny);
      this.value.x = nx / this.radius;
      this.value.y = ny / this.radius;
    });

    const release = (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== p.id) return;
      this.activePointerId = null;
      this.value.x = 0;
      this.value.y = 0;
      this.value.active = false;
      this.base.setVisible(false);
      this.thumb.setVisible(false);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  destroy(): void {
    this.base.destroy();
    this.thumb.destroy();
  }
}
