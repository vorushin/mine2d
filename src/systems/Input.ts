import Phaser from 'phaser';

export interface InputVector {
  x: number;
  y: number;
}

/**
 * Unified input abstraction. Desktop uses WASD + mouse.
 * Mobile touch uses an external VirtualJoystick that writes into the same vector via setJoystickVector().
 */
export class InputSystem {
  private keys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private joystickVec: InputVector = { x: 0, y: 0 };
  readonly events = new Phaser.Events.EventEmitter();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Hotbar number keys 1-8
    for (let i = 1; i <= 8; i++) {
      const key = kb.addKey(`${i}`);
      key.on('down', () => this.events.emit('hotbar_select', i - 1));
    }

    // Space = attack / interact, E = toggle door / interact
    kb.on('keydown-SPACE', () => this.events.emit('attack'));
    kb.on('keydown-E', () => this.events.emit('interact'));
    kb.on('keydown-N', () => this.events.emit('skip_to_night'));
  }

  setJoystickVector(v: InputVector): void {
    this.joystickVec.x = v.x;
    this.joystickVec.y = v.y;
  }

  getMoveVector(): InputVector {
    let x = 0;
    let y = 0;
    if (this.keys.A.isDown) x -= 1;
    if (this.keys.D.isDown) x += 1;
    if (this.keys.W.isDown) y -= 1;
    if (this.keys.S.isDown) y += 1;
    const mag = Math.hypot(x, y);
    if (mag > 0) {
      x /= mag;
      y /= mag;
      return { x, y };
    }
    // Fall back to joystick
    return this.joystickVec;
  }

  destroy(): void {
    this.events.removeAllListeners();
  }
}
