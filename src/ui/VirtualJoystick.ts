import Phaser from 'phaser';
import { Thumbstick, ThumbstickValue } from './Thumbstick';

/**
 * Movement thumbstick — the left-bottom pad. Fixed-position, always-visible
 * base circle. Touch starts only register when they begin inside the base.
 */
export class VirtualJoystick {
  private stick: Thumbstick;
  readonly value: ThumbstickValue;

  constructor(scene: Phaser.Scene, baseX: number, baseY: number, radius = 60) {
    this.stick = new Thumbstick(scene, { baseX, baseY, radius });
    this.value = this.stick.value;
  }

  setPosition(x: number, y: number): void {
    this.stick.setPosition(x, y);
  }

  destroy(): void {
    this.stick.destroy();
  }
}
