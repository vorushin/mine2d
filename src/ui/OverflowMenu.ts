import Phaser from 'phaser';

export interface OverflowMenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  /**
   * Optional predicate. If supplied and returns false at open time, the
   * item is omitted from the popup for that opening.
   */
  isVisible?: () => boolean;
}

const ITEM_W = 160;
const ITEM_H = 36;
const GAP = 4;

/**
 * Top-right "⋯" button that opens a small vertical popup of secondary
 * actions. Used on touch to keep low-frequency controls out of the always-
 * visible HUD.
 */
export class OverflowMenu {
  private scene: Phaser.Scene;
  private items: OverflowMenuItem[];
  private button: Phaser.GameObjects.Rectangle;
  private buttonLabel: Phaser.GameObjects.Text;
  private popup: Phaser.GameObjects.Container | null = null;
  private backdrop: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene, items: OverflowMenuItem[]) {
    this.scene = scene;
    this.items = items;
    this.button = scene.add.rectangle(0, 0, 28, 28, 0x1a1c22, 0.92)
      .setStrokeStyle(2, 0x88aaff, 0.7)
      .setScrollFactor(0)
      .setDepth(700);
    this.buttonLabel = scene.add.text(0, 0, '⋯', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(701);
    this.button.setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => this.toggle());
  }

  setPosition(x: number, y: number): void {
    this.button.setPosition(x, y);
    this.buttonLabel.setPosition(x, y);
  }

  private toggle(): void {
    if (this.popup) this.close();
    else this.open();
  }

  private open(): void {
    const visible = this.items.filter((it) => it.isVisible?.() ?? true);
    if (visible.length === 0) return;

    this.backdrop = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1500)
      .setInteractive();
    this.backdrop.on('pointerdown', () => this.close());

    const totalH = visible.length * ITEM_H + (visible.length - 1) * GAP;
    const popupX = this.button.x - ITEM_W / 2 + 14; // right edge ~ aligned with button
    const popupY = this.button.y + 18 + totalH / 2;
    this.popup = this.scene.add.container(popupX, popupY).setDepth(1501).setScrollFactor(0);
    for (let i = 0; i < visible.length; i++) {
      const it = visible[i];
      const offsetY = i * (ITEM_H + GAP) - totalH / 2 + ITEM_H / 2;
      const bg = this.scene.add.rectangle(0, offsetY, ITEM_W, ITEM_H, 0x26334a, 0.97)
        .setStrokeStyle(1, 0x88aaff, 0.6)
        .setScrollFactor(0);
      const text = this.scene.add.text(0, offsetY, `${it.icon}  ${it.label}`, {
        fontFamily: 'system-ui', fontSize: '13px', color: '#fff',
      }).setOrigin(0.5).setScrollFactor(0);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        it.onPress();
        this.close();
      });
      this.popup.add([bg, text]);
    }
  }

  private close(): void {
    this.popup?.destroy(true);
    this.popup = null;
    this.backdrop?.destroy();
    this.backdrop = null;
  }

  destroy(): void {
    this.close();
    this.button.destroy();
    this.buttonLabel.destroy();
  }
}
