import Phaser from 'phaser';
import { PowerUpKind } from '../state/GameState';
import { POWER_UP_SPECS } from '../systems/PowerUps';

export class PowerOrb {
  readonly kind: PowerUpKind;
  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private baseY: number;
  private t = 0;
  private collected = false;
  alive = true;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number, kind: PowerUpKind) {
    this.scene = scene;
    this.kind = kind;
    this.baseY = worldY;
    const spec = POWER_UP_SPECS[kind];
    this.container = scene.add.container(worldX, worldY).setDepth(12);
    const outer = scene.add.circle(0, 0, 16, spec.color, 0.28).setStrokeStyle(2, spec.color, 0.8);
    const core = scene.add.circle(0, 0, 8, spec.color, 0.95);
    const label = scene.add.text(0, 0, spec.shortLabel[0], {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '10px',
      color: '#071018',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add([outer, core, label]);
    scene.tweens.add({
      targets: outer,
      scale: 1.35,
      alpha: 0.1,
      yoyo: true,
      repeat: -1,
      duration: 500,
    });
    scene.tweens.add({
      targets: this.container,
      scale: { from: 0.4, to: 1 },
      alpha: { from: 0, to: 1 },
      y: worldY - 10,
      duration: 240,
    });
  }

  update(deltaMs: number, playerX: number, playerY: number): { collect: boolean; kind?: PowerUpKind } {
    if (!this.alive) return { collect: false };
    this.t += deltaMs / 1000;
    if (!this.collected) {
      this.container.y = this.baseY - 10 + Math.sin(this.t * 5) * 3;
      const dx = playerX - this.container.x;
      const dy = playerY - this.container.y;
      const d = Math.hypot(dx, dy);
      if (d < 110 && d > 20) {
        const mag = Math.max(0.01, d);
        const pull = ((110 - d) / 90) * (260 * deltaMs / 1000);
        this.container.x += (dx / mag) * pull;
        this.baseY += (dy / mag) * pull;
      }
      if (d < 22) {
        this.collected = true;
        this.scene.tweens.add({
          targets: this.container,
          x: playerX,
          y: playerY,
          scale: 1.8,
          alpha: 0,
          duration: 180,
          onComplete: () => {
            this.alive = false;
            this.container.destroy();
          },
        });
        return { collect: true, kind: this.kind };
      }
    }
    return { collect: false };
  }
}
