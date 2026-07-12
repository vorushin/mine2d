import Phaser from 'phaser';
import { SaveStore } from '../systems/SaveStore';
import { GameState, RunStats } from '../state/GameState';
import { sounds } from '../systems/Sound';
import { music } from '../systems/Music';
import { MetaStore } from '../systems/MetaStore';
import { levelById } from '../systems/Campaign';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: { score: number; stats?: RunStats; state?: GameState; coinsEarned?: number; campaignLevelId?: string | null }): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(0x0e1116);
    music.setTheme('menu');

    const campaignDef = data.campaignLevelId ? levelById(data.campaignLevelId) : null;
    const victorious = data.state?.victory === true;
    this.add.text(w / 2, h / 2 - 160, victorious ? 'a legend falls' : campaignDef ? 'level failed' : 'you died', {
      fontFamily: 'system-ui', fontSize: '56px', color: victorious ? '#ffd166' : '#ff7070', fontStyle: 'bold',
      stroke: '#330000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(w / 2, h / 2 - 100, victorious
      ? `👑 beat the Zombie King · ${data.score} nights survived`
      : campaignDef
        ? `🗺 ${campaignDef.title} — the horde got you. Try again!`
        : `Nights survived: ${data.score}`, {
      fontFamily: 'ui-monospace, monospace', fontSize: '20px', color: '#fff',
    }).setOrigin(0.5);

    if (!campaignDef) {
      const best = SaveStore.getBestScore();
      const newRecord = data.score > 0 && data.score >= best;
      this.add.text(w / 2, h / 2 - 70, newRecord ? `★ NEW RECORD! Best: ${best}` : `Best: ${best}`, {
        fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: newRecord ? '#ffd166' : '#a0cfa0',
      }).setOrigin(0.5);
    }

    if (data.coinsEarned && data.coinsEarned > 0) {
      const total = MetaStore.get().coins;
      this.add.text(w / 2, h / 2 - 48, `⭐ +${data.coinsEarned} Star Coins  (total ${total}) — spend them in the Hero's Hut`, {
        fontFamily: 'system-ui', fontSize: '14px', color: '#ffe082', fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    if (data.stats) {
      const rows: [string, string | number][] = [
        ['Zombies killed', data.stats.zombiesKilled],
        ['Tiles mined', data.stats.tilesMined],
        ['Tiles built', data.stats.tilesPlaced],
        ['Gold earned', data.stats.goldEarned],
      ];
      const panelW = 320;
      const panelH = 18 + rows.length * 22 + 10;
      const panelY = h / 2 - 30;
      this.add.rectangle(w / 2, panelY + panelH / 2, panelW, panelH, 0x1a1c22, 0.85).setStrokeStyle(1, 0x555, 0.7);
      for (let i = 0; i < rows.length; i++) {
        const [label, val] = rows[i];
        this.add.text(w / 2 - panelW / 2 + 16, panelY + 10 + i * 22, label, {
          fontFamily: 'system-ui', fontSize: '13px', color: '#cfd6e0',
        });
        this.add.text(w / 2 + panelW / 2 - 16, panelY + 10 + i * 22, String(val), {
          fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#ffd166', fontStyle: 'bold',
        }).setOrigin(1, 0);
      }
    }

    const btn = this.add.rectangle(w / 2, h / 2 + 200, 220, 48, 0x3a7a3a).setStrokeStyle(2, 0x88ff88, 0.7);
    this.add.text(w / 2, h / 2 + 200, campaignDef ? '↻  Retry Level' : '▶  Try Again', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setFillStyle(0x4a9a4a));
    btn.on('pointerout', () => btn.setFillStyle(0x3a7a3a));
    btn.on('pointerdown', () => {
      sounds.click();
      if (campaignDef) this.scene.start('Game', { campaign: { levelId: campaignDef.id } });
      else this.scene.start('Game');
    });

    const menuBtn = this.add.rectangle(w / 2, h / 2 + 260, 160, 36, 0x26334a).setStrokeStyle(1, 0x88aaff, 0.6);
    this.add.text(w / 2, h / 2 + 260, campaignDef ? '🗺 Campaign Map' : 'Main Menu', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#fff',
    }).setOrigin(0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => {
      sounds.click();
      this.scene.start(campaignDef ? 'Campaign' : 'Menu');
    });
  }
}
