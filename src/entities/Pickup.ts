import Phaser from 'phaser';
import { MaterialId } from '../world/tileTypes';

const COLORS: Record<MaterialId, number> = {
  wood: 0x9c6a3f,
  stone: 0x888888,
  iron: 0xc9b037,
  gold: 0xffd700,
  arrow: 0xe6e6e6,
  bullet: 0xffaa00,
  lava: 0xff4d1a,
  bomb: 0x2a2a2a,
  wallReinforced: 0x5a5a70,
  turretFlame: 0xff8030,
};

const LETTERS: Record<MaterialId, string> = {
  wood: 'W',
  stone: 'S',
  iron: 'I',
  gold: 'G',
  arrow: 'A',
  bullet: 'B',
  lava: 'L',
  bomb: 'X',
  wallReinforced: 'R',
  turretFlame: 'T',
};

/**
 * A floating material pickup. Bobs gently until the player walks over it, then
 * flies to the player and is consumed (adds to inventory).
 */
export class Pickup {
  readonly material: MaterialId;
  readonly count: number;
  readonly container: Phaser.GameObjects.Container;
  private chip: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private baseY: number;
  private t = 0;
  alive = true;
  private collected = false;

  constructor(scene: Phaser.Scene, worldX: number, worldY: number, material: MaterialId, count: number) {
    this.scene = scene;
    this.material = material;
    this.count = count;
    this.baseY = worldY;
    this.container = scene.add.container(worldX, worldY);
    this.container.setDepth(11);
    this.chip = scene.add.rectangle(0, 0, 18, 18, COLORS[material]).setStrokeStyle(2, 0x000000, 0.8);
    this.label = scene.add.text(0, 0, `${LETTERS[material]}${count > 1 ? '×' + count : ''}`, {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '10px',
      color: '#000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const glow = scene.add.circle(0, 0, 14, COLORS[material], 0.25);
    glow.setDepth(0);
    this.container.add([glow, this.chip, this.label]);
    // Fly-out burst on spawn
    this.container.setAlpha(0);
    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      x: worldX + (Math.random() - 0.5) * 16,
      y: worldY - 12 + (Math.random() - 0.5) * 8,
      duration: 250,
    });
  }

  update(deltaMs: number, playerX: number, playerY: number): { collect: boolean } {
    if (!this.alive) return { collect: false };
    this.t += deltaMs / 1000;
    if (!this.collected) {
      this.container.y = this.baseY - 8 + Math.sin(this.t * 4) * 2;
      const dx = playerX - this.container.x;
      const dy = playerY - this.container.y;
      const d = Math.hypot(dx, dy);
      // Magnetic attraction in a wider radius
      if (d < 70 && d > 20) {
        const mag = Math.max(0.01, d);
        const pull = ((70 - d) / 50) * (180 * deltaMs / 1000);
        this.container.x += (dx / mag) * pull;
        this.baseY += (dy / mag) * pull;
      }
      if (d < 20) {
        this.collected = true;
        this.scene.tweens.add({
          targets: this.container,
          x: playerX,
          y: playerY,
          scale: 0.2,
          alpha: 0,
          duration: 160,
          onComplete: () => {
            this.alive = false;
            this.container.destroy();
          },
        });
        return { collect: true };
      }
    }
    return { collect: false };
  }

  destroy(): void {
    this.alive = false;
    this.container.destroy();
  }
}
