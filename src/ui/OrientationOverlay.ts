import Phaser from 'phaser';

/**
 * Touch-only overlay that covers the screen with a "rotate to landscape"
 * message whenever the device is in portrait. Polled from UIScene.update().
 */
export class OrientationOverlay {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Rectangle;
  private icon: Phaser.GameObjects.Text;
  private label: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x0e1116, 0.96)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(3000);
    this.icon = scene.add.text(0, 0, '↻', {
      fontFamily: 'system-ui', fontSize: '64px', color: '#88aaff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    this.label = scene.add.text(0, 0, 'Rotate your phone to landscape', {
      fontFamily: 'system-ui', fontSize: '18px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    this.setVisibility(false);
  }

  update(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const isPortrait = h > w;
    if (isPortrait !== this.visible) this.setVisibility(isPortrait);
    if (this.visible) {
      this.bg.setSize(w, h);
      this.icon.setPosition(w / 2, h / 2 - 20);
      this.label.setPosition(w / 2, h / 2 + 36);
    }
  }

  private setVisibility(v: boolean): void {
    this.visible = v;
    this.bg.setVisible(v);
    this.icon.setVisible(v);
    this.label.setVisible(v);
  }

  destroy(): void {
    this.bg.destroy();
    this.icon.destroy();
    this.label.destroy();
  }
}
