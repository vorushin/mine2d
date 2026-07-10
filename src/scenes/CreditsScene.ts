import Phaser from 'phaser';
import { RunStats } from '../state/GameState';
import { music } from '../systems/Music';
import { sounds } from '../systems/Sound';

interface CreditsData {
  night: number;
  stats: RunStats;
  /** Replayed from the menu — no paused run to go back to. */
  fromMenu?: boolean;
}

/**
 * Victory credits — shown when the Zombie King falls. Scrolling lines, then
 * choices: keep playing in Endless+ or return to the menu. Launched OVER the
 * paused GameScene so the run can continue afterwards.
 */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create(data: CreditsData): void {
    const w = this.scale.width;
    const h = this.scale.height;

    music.setTheme('victory');

    const veil = this.add.rectangle(0, 0, w, h, 0x05050e, 0).setOrigin(0, 0).setDepth(0);
    this.tweens.add({ targets: veil, fillAlpha: 0.92, duration: 900 });

    const lines: { text: string; size: number; color: string }[] = [
      { text: '👑', size: 60, color: '#ffd700' },
      { text: 'THE ZOMBIE KING HAS FALLEN', size: 40, color: '#ffd166' },
      { text: `conquered on night ${data.night}`, size: 18, color: '#c8dbef' },
      { text: '', size: 14, color: '#fff' },
      { text: 'MINE2D II: THE DEEP DARK', size: 26, color: '#7fe7ff' },
      { text: 'a game made for Robert', size: 20, color: '#ffb0d8' },
      { text: '', size: 14, color: '#fff' },
      { text: `zombies defeated  ·  ${data.stats.zombiesKilled}`, size: 16, color: '#e6e6e6' },
      { text: `tiles mined  ·  ${data.stats.tilesMined}`, size: 16, color: '#e6e6e6' },
      { text: `tiles built  ·  ${data.stats.tilesPlaced}`, size: 16, color: '#e6e6e6' },
      { text: `gold earned  ·  ${data.stats.goldEarned}`, size: 16, color: '#ffd166' },
      { text: '', size: 14, color: '#fff' },
      { text: 'starring', size: 14, color: '#7a8595' },
      { text: 'ROBERT — the hero', size: 20, color: '#ffe082' },
      { text: 'REX — the very best boy', size: 18, color: '#c89560' },
      { text: 'the chickens — themselves', size: 16, color: '#e6e6e6' },
      { text: '', size: 14, color: '#fff' },
      { text: '⭐ ENDLESS+ UNLOCKED ⭐', size: 22, color: '#9cff9c' },
      { text: 'the nights grow harder — the legend grows longer', size: 14, color: '#c8dbef' },
    ];

    const startY = h + 30;
    let y = startY;
    const objs: Phaser.GameObjects.Text[] = [];
    for (const line of lines) {
      const t = this.add.text(w / 2, y, line.text, {
        fontFamily: 'system-ui', fontSize: `${line.size}px`, color: line.color, fontStyle: 'bold',
        stroke: '#000', strokeThickness: 4, align: 'center',
      }).setOrigin(0.5).setDepth(2);
      objs.push(t);
      y += line.size + 18;
    }
    const totalH = y - startY;

    // Scroll everything up until centered-ish, over ~14 s
    this.tweens.add({
      targets: objs,
      y: `-=${totalH * 0.55 + h * 0.62}`,
      duration: 14000,
      ease: 'Sine.easeOut',
    });

    // Confetti bursts during the scroll
    const colors = [0xff4d88, 0xffd166, 0x8aa0ff, 0x7fce7f, 0xff66aa, 0xa0ffff];
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(600 + i * 1200, () => {
        const x = w * (0.2 + Math.random() * 0.6);
        const py = h * (0.15 + Math.random() * 0.4);
        const c = colors[i % colors.length];
        const emitter = this.add.particles(x, py, 'particle', {
          speed: { min: 60, max: 220 },
          lifespan: 900,
          quantity: 24,
          scale: { start: 1.4, end: 0 },
          tint: c,
          emitting: false,
        }).setDepth(3);
        emitter.explode(24);
        sounds.click();
        this.time.delayedCall(1200, () => emitter.destroy());
      });
    }

    // Buttons appear after a while
    this.time.delayedCall(6000, () => {
      const mkButton = (yy: number, label: string, color: number, onPress: () => void) => {
        const btn = this.add.rectangle(w / 2, yy, 280, 52, color).setStrokeStyle(2, 0xffffff, 0.75).setDepth(5);
        this.add.text(w / 2, yy, label, {
          fontFamily: 'system-ui', fontSize: '19px', color: '#fff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(6);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          sounds.click();
          onPress();
        });
        return btn;
      };
      if (data.fromMenu) {
        mkButton(h - 66, '🏠  Main Menu', 0x26334a, () => {
          this.scene.start('Menu');
        });
      } else {
        mkButton(h - 130, '▶  Keep playing (Endless+)', 0x3a7a3a, () => {
          this.scene.stop();
          this.scene.resume('Game');
          this.scene.resume('UI');
        });
        mkButton(h - 66, '🏠  Main Menu', 0x26334a, () => {
          this.scene.stop('UI');
          this.scene.stop('Game');
          this.scene.start('Menu');
        });
      }
    });
  }
}
