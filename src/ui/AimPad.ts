import Phaser from 'phaser';
import { Thumbstick } from './Thumbstick';

/**
 * Aim / fire thumbstick — the right-bottom pad. Same fixed-position semantics
 * as VirtualJoystick. Re-exports the underlying events ('press', 'change',
 * 'release') for the GameScene to consume. The 'release' event carries the
 * stick's last non-zero value before it snapped back to center, which is
 * useful for single-shot tools (bombs).
 */
export class AimPad {
  private stick: Thumbstick;
  readonly events: Phaser.Events.EventEmitter;
  readonly value: { x: number; y: number; active: boolean };

  constructor(scene: Phaser.Scene, baseX: number, baseY: number, radius = 60) {
    this.stick = new Thumbstick(scene, { baseX, baseY, radius });
    this.events = this.stick.events;
    this.value = this.stick.value;
  }

  setPosition(x: number, y: number): void {
    this.stick.setPosition(x, y);
  }

  destroy(): void {
    this.stick.destroy();
  }
}
