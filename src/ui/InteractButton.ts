import Phaser from 'phaser';

export type InteractTag = 'shop' | 'bench' | 'door';

const ICONS: Record<InteractTag, string> = {
  shop: '💰',
  bench: '⚒',
  door: '🚪',
};

/**
 * Small floating circular button that appears just above the right pad when
 * the player is adjacent to an interactable tile. Tap fires `onPress`.
 */
export class InteractButton {
  private bg: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private currentTag: InteractTag | null = null;

  constructor(scene: Phaser.Scene, onPress: () => void) {
    this.bg = scene.add.circle(0, 0, 22, 0xffcc66, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.6)
      .setScrollFactor(0).setDepth(1100);
    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#222', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1101);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', onPress);
    this.setVisibility(false);
  }

  setTag(tag: InteractTag | null): void {
    if (tag === this.currentTag) return;
    this.currentTag = tag;
    if (!tag) {
      this.setVisibility(false);
      return;
    }
    this.label.setText(ICONS[tag]);
    this.setVisibility(true);
  }

  setPosition(x: number, y: number): void {
    this.bg.setPosition(x, y);
    this.label.setPosition(x, y);
  }

  private setVisibility(v: boolean): void {
    this.bg.setVisible(v);
    this.label.setVisible(v);
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }
}
