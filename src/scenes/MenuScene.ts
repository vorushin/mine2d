import Phaser from 'phaser';
import { SaveStore } from '../systems/SaveStore';
import { SaveLoad } from '../systems/SaveLoad';
import { TEX } from '../gfx/textures';
import { sounds } from '../systems/Sound';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(0x162033);

    // Background grid of grass/dirt tiles
    const bg = this.add.graphics();
    for (let y = 0; y < h + 64; y += 32) {
      for (let x = 0; x < w + 64; x += 32) {
        const r = (Math.sin(x * 0.3 + y * 0.2) + 1) / 2;
        const c = r > 0.5 ? 0x1a2a1a : 0x0f1a0f;
        bg.fillStyle(c, 1);
        bg.fillRect(x, y, 32, 32);
      }
    }

    // Sprite showcase at bottom
    const decor = [TEX.tree, TEX.stone, TEX.iron_ore, TEX.gold_ore, TEX.torch, TEX.crafting_bench, TEX.chest, TEX.shop_npc, 'zombie_normal', 'zombie_fast', 'zombie_armored'];
    const totalDecorW = decor.length * 64;
    const startX = (w - totalDecorW) / 2 + 32;
    for (let i = 0; i < decor.length; i++) {
      const img = this.add.image(startX + i * 64, h - 90, decor[i]);
      img.setScale(1.8);
      this.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 900 + i * 50 });
    }

    const title = this.add.text(w / 2, h / 2 - 120, 'mine2d', {
      fontFamily: 'system-ui', fontSize: '80px', color: '#ffe082', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: title.y - 6, yoyo: true, repeat: -1, duration: 1600 });

    this.add.text(w / 2, h / 2 - 50, 'mine by day · survive the night', {
      fontFamily: 'system-ui', fontSize: '18px', color: '#c8dbef',
    }).setOrigin(0.5);

    this.add.text(w / 2, h / 2 - 20, '🎂  a birthday game for Robert  🎂', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#ffb0d8',
    }).setOrigin(0.5);

    const best = SaveStore.getBestScore();
    this.add.text(w / 2, h / 2 + 90, best > 0 ? `★ Best: ${best} night${best === 1 ? '' : 's'}` : '★ No score yet — go make one', {
      fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#ffd166',
    }).setOrigin(0.5);

    const hasSave = SaveLoad.hasSave();
    const startY = hasSave ? h / 2 + 40 : h / 2 + 20;

    if (hasSave) {
      const savedAt = SaveLoad.savedAt();
      const when = savedAt ? savedAt.toLocaleString() : '';
      const contBtn = this.add.rectangle(w / 2, h / 2 - 10, 260, 54, 0x2e5ea0).setStrokeStyle(3, 0x9fc2ff, 0.9);
      this.add.text(w / 2, h / 2 - 10, '↻  Continue Run', { fontFamily: 'system-ui', fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      if (when) this.add.text(w / 2, h / 2 + 18, when, { fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#c8dbef' }).setOrigin(0.5);
      contBtn.setInteractive({ useHandCursor: true });
      contBtn.on('pointerover', () => contBtn.setFillStyle(0x3e77c5));
      contBtn.on('pointerout', () => contBtn.setFillStyle(0x2e5ea0));
      contBtn.on('pointerdown', () => {
        sounds.ensure();
        sounds.click();
        const snap = SaveLoad.load();
        if (snap) this.scene.start('Game', { loadSnapshot: snap });
        else this.scene.start('Game');
      });
    }

    const btn = this.add.rectangle(w / 2, startY, 240, 58, 0x3a7a3a).setStrokeStyle(3, 0x88ff88, 0.85);
    this.add.text(w / 2, startY, hasSave ? '▶  New Run' : '▶  Start Run', { fontFamily: 'system-ui', fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setFillStyle(0x4a9a4a));
    btn.on('pointerout', () => btn.setFillStyle(0x3a7a3a));
    btn.on('pointerdown', () => {
      sounds.ensure();
      sounds.click();
      // Starting a new run clears any saved game
      if (hasSave) SaveLoad.clear();
      this.scene.start('Game');
    });

    const hint = 'WASD/Joystick move  ·  Click/Tap use item  ·  1-0 hotbar  ·  C craft  ·  E interact  ·  N night  ·  H help';
    this.add.text(w / 2, h - 24, hint, { fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#7a8595' }).setOrigin(0.5);
  }
}
