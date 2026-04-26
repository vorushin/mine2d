import Phaser from 'phaser';
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from '../config';
import { GameScene } from '../scenes/GameScene';
import { TileType } from '../world/tileTypes';

/**
 * Tiny minimap: a static canvas of the world (ground types) painted once,
 * plus live dots for player, dog, zombies, shop, cake drawn each frame.
 */
export class Minimap {
  private scene: Phaser.Scene;
  private gameScene: GameScene;
  private container: Phaser.GameObjects.Container;
  private staticLayer: Phaser.GameObjects.Graphics;
  private dynamicLayer: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private mapSize: number;

  constructor(scene: Phaser.Scene, gameScene: GameScene, mapSize = 140) {
    this.scene = scene;
    this.gameScene = gameScene;
    this.mapSize = mapSize;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(700);
    this.bg = scene.add.rectangle(0, 0, this.mapSize + 8, this.mapSize + 22, 0x1a1c22, 0.88).setOrigin(1, 1);
    this.border = scene.add.rectangle(0, 0, this.mapSize + 8, this.mapSize + 22, 0, 0).setStrokeStyle(1, 0x88aaff, 0.6).setOrigin(1, 1);
    this.label = scene.add.text(0, 0, 'MAP', {
      fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: '#9eb0c4', fontStyle: 'bold',
    }).setOrigin(1, 1);
    this.staticLayer = scene.add.graphics();
    this.dynamicLayer = scene.add.graphics();
    this.container.add([this.bg, this.border, this.staticLayer, this.dynamicLayer, this.label]);
    this.paintStatic();
    this.layout();
  }

  private paintStatic(): void {
    const cell = this.mapSize / WORLD_WIDTH;
    this.staticLayer.clear();
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const t = this.gameScene.world.tiles[y][x];
        let c = 0x3a7a3a; // grass
        if (t.type === TileType.Dirt) c = 0x6a4a2b;
        else if (t.type === TileType.Sand) c = 0xd8c779;
        else if (t.type === TileType.Water) c = 0x3e6db0;
        else if (t.type === TileType.Stone || t.type === TileType.WallStone) c = 0x808080;
        else if (t.type === TileType.IronOre) c = 0xc9b037;
        else if (t.type === TileType.GoldOre) c = 0xffd700;
        else if (t.type === TileType.Tree || t.type === TileType.DeadTree) c = 0x1d5820;
        else if (t.type === TileType.WallWood) c = 0x9c6a3f;
        else if (t.type === TileType.WallIron) c = 0xb0b0c0;
        else if (t.type === TileType.WallReinforced) c = 0x5a5a70;
        else if (t.type === TileType.Lava) c = 0xff4d1a;
        else if (t.type === TileType.FlowerField) c = 0xffb0d8;
        else if (t.type === TileType.Volcano) c = 0xcc2010;
        else if (t.type === TileType.Crater) c = 0x3a2410;
        else if (t.type === TileType.Bridge) c = 0x9c6a3f;
        else if (t.type === TileType.TurretFlame) c = 0xff8030;
        this.staticLayer.fillStyle(c, 1);
        this.staticLayer.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  private repaintTimer = 0;

  update(): void {
    const cell = this.mapSize / WORLD_WIDTH;
    this.dynamicLayer.clear();

    // Repaint static layer every half-second (handles meteor craters, lava spread)
    this.repaintTimer += 1;
    if (this.repaintTimer >= 30) {
      this.repaintTimer = 0;
      this.paintStatic();
    }

    // Shop (yellow star-ish)
    const shop = this.gameScene.world.shopPos;
    if (shop) {
      this.dynamicLayer.fillStyle(0xffd700, 1);
      this.dynamicLayer.fillRect(shop.x * cell - 2, shop.y * cell - 2, 4, 4);
    }

    // Player
    const p = this.gameScene.world.worldToTile(this.gameScene.player.x, this.gameScene.player.y);
    this.dynamicLayer.fillStyle(0xffffff, 1);
    this.dynamicLayer.fillRect(p.x * cell - 1, p.y * cell - 1, 3, 3);
    this.dynamicLayer.lineStyle(1, 0x000000, 1);
    this.dynamicLayer.strokeRect(p.x * cell - 1, p.y * cell - 1, 3, 3);

    // Dog
    if (this.gameScene.dog?.alive) {
      const dp = this.gameScene.world.worldToTile(this.gameScene.dog.x, this.gameScene.dog.y);
      this.dynamicLayer.fillStyle(0xc89560, 1);
      this.dynamicLayer.fillRect(dp.x * cell - 1, dp.y * cell - 1, 2, 2);
    }

    // Zombies
    for (const z of this.gameScene.zombies) {
      if (!z.alive) continue;
      const zp = this.gameScene.world.worldToTile(z.sprite.x, z.sprite.y);
      const isBoss = z.variant === 'boss';
      this.dynamicLayer.fillStyle(isBoss ? 0xff2020 : 0xff6060, 1);
      this.dynamicLayer.fillRect(zp.x * cell - 1, zp.y * cell - 1, isBoss ? 3 : 2, isBoss ? 3 : 2);
    }
  }

  layout(): void {
    const w = this.scene.scale.width;
    const pad = 10;
    this.container.setPosition(w - pad, this.scene.scale.height - 130);
    this.bg.setPosition(0, 0);
    this.border.setPosition(0, 0);
    this.label.setPosition(-this.mapSize + 10, -this.mapSize - 4);
    this.staticLayer.setPosition(-this.mapSize - 4, -this.mapSize - 4);
    this.dynamicLayer.setPosition(-this.mapSize - 4, -this.mapSize - 4);
  }

  /**
   * Position the minimap container at an explicit (x, y) in screen space
   * (top-right corner of the rendered region). Used by MinimapToggle's
   * larger modal view.
   */
  layoutAt(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.bg.setPosition(0, 0);
    this.border.setPosition(0, 0);
    this.label.setPosition(-this.mapSize + 10, -this.mapSize - 4);
    this.staticLayer.setPosition(-this.mapSize - 4, -this.mapSize - 4);
    this.dynamicLayer.setPosition(-this.mapSize - 4, -this.mapSize - 4);
  }

  destroy(): void {
    this.container.destroy();
  }
}

void TILE_SIZE;
