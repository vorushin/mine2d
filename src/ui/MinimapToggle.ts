import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';
import { Minimap } from './Minimap';

/**
 * Touch-only minimap. A small icon in the top-right HUD; tap to open a
 * centered modal containing a larger Minimap. The game keeps running
 * underneath. The icon shows a small red dot when there's an off-screen
 * threat (boss alive at any time, or any zombie alive at night/dusk).
 */
export class MinimapToggle {
  private scene: Phaser.Scene;
  private gameScene: GameScene;
  private icon: Phaser.GameObjects.Rectangle;
  private iconLabel: Phaser.GameObjects.Text;
  private dot: Phaser.GameObjects.Arc;
  private modalContainer: Phaser.GameObjects.Container | null = null;
  private modalMinimap: Minimap | null = null;

  constructor(scene: Phaser.Scene, gameScene: GameScene) {
    this.scene = scene;
    this.gameScene = gameScene;
    this.icon = scene.add.rectangle(0, 0, 28, 28, 0x1a1c22, 0.92)
      .setStrokeStyle(2, 0x88aaff, 0.7)
      .setScrollFactor(0)
      .setDepth(700);
    this.iconLabel = scene.add.text(0, 0, '🗺', {
      fontFamily: 'system-ui', fontSize: '16px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(701);
    this.dot = scene.add.circle(0, 0, 4, 0xff3030, 1)
      .setScrollFactor(0).setDepth(702).setVisible(false);
    this.icon.setInteractive({ useHandCursor: true });
    this.icon.on('pointerdown', () => this.toggleModal());
  }

  setPosition(x: number, y: number): void {
    this.icon.setPosition(x, y);
    this.iconLabel.setPosition(x, y);
    this.dot.setPosition(x + 10, y - 10);
  }

  update(): void {
    const phase = this.gameScene.state.phase;
    const anyZ = this.gameScene.zombies.some((z) => z.alive);
    const boss = this.gameScene.zombies.some((z) => z.alive && z.variant === 'boss');
    const danger = boss || (anyZ && (phase === 'night' || phase === 'dusk'));
    this.dot.setVisible(danger);
  }

  isOpen(): boolean {
    return this.modalContainer !== null;
  }

  updateModalMap(): void {
    this.modalMinimap?.update();
  }

  private toggleModal(): void {
    if (this.modalContainer) this.closeModal();
    else this.openModal();
  }

  private openModal(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const mapSize = Math.floor(Math.min(w, h) * 0.7);
    this.modalContainer = this.scene.add.container(0, 0).setDepth(2100).setScrollFactor(0);
    const backdrop = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.45)
      .setOrigin(0, 0).setScrollFactor(0).setInteractive();
    backdrop.on('pointerdown', () => this.closeModal());
    this.modalContainer.add(backdrop);

    this.modalMinimap = new Minimap(this.scene, this.gameScene, mapSize);
    const cx = w / 2;
    const cy = h / 2;
    this.modalMinimap.layoutAt(cx + mapSize / 2 + 4, cy + mapSize / 2 + 16);

    const closeBtn = this.scene.add.rectangle(cx + mapSize / 2, cy - mapSize / 2 - 18, 32, 24, 0x4a2030, 0.92)
      .setStrokeStyle(1, 0xff6666, 0.7).setScrollFactor(0);
    const closeLabel = this.scene.add.text(closeBtn.x, closeBtn.y, '✕', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeModal());
    this.modalContainer.add([closeBtn, closeLabel]);
  }

  private closeModal(): void {
    this.modalMinimap?.destroy();
    this.modalMinimap = null;
    this.modalContainer?.destroy(true);
    this.modalContainer = null;
  }

  destroy(): void {
    this.closeModal();
    this.icon.destroy();
    this.iconLabel.destroy();
    this.dot.destroy();
  }
}
