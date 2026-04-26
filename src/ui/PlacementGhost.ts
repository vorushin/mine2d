import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

/**
 * A semi-transparent tile-sized rectangle that previews where a placement
 * would happen. `setTarget(tx, ty)` moves the ghost to a tile coordinate;
 * `setValid(bool)` recolors it red when invalid.
 */
export class PlacementGhost {
  private rect: Phaser.GameObjects.Rectangle;
  private color: number;

  constructor(scene: Phaser.Scene, color: number) {
    this.color = color;
    this.rect = scene.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, color, 0.45)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setDepth(15);
  }

  setTarget(tx: number, ty: number): void {
    this.rect.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
  }

  setColor(color: number): void {
    this.color = color;
    this.rect.setFillStyle(color, 0.45);
  }

  setValid(valid: boolean): void {
    if (valid) {
      this.rect.setFillStyle(this.color, 0.45);
      this.rect.setStrokeStyle(2, 0xffffff, 0.85);
    } else {
      this.rect.setFillStyle(0xff2020, 0.35);
      this.rect.setStrokeStyle(2, 0xff6666, 0.85);
    }
  }

  setVisible(v: boolean): void {
    this.rect.setVisible(v);
  }

  destroy(): void {
    this.rect.destroy();
  }
}
