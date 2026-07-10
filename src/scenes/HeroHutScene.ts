import Phaser from 'phaser';
import { COMPANION_SPECS } from '../entities/Companion';
import { CLASS_SPECS } from '../systems/Classes';
import { MetaStore, UnlockKind, priceOf } from '../systems/MetaStore';
import { sounds } from '../systems/Sound';

/**
 * The Hero's Hut — spend Star Coins earned by playing on permanent unlocks:
 * companions, classes, and world modifiers. Simple tap-friendly rows.
 */

interface HutRow {
  kind: UnlockKind;
  id: string;
  icon: string;
  name: string;
  blurb: string;
}

const MODIFIER_ROWS: HutRow[] = [
  { kind: 'modifier', id: 'winter', icon: '❄️', name: 'Winter World', blurb: 'The lake freezes solid — walk across it! Icy, tougher zombies.' },
  { kind: 'modifier', id: 'island', icon: '🏝️', name: 'Island World', blurb: 'Way more water. Bridges are your best friends.' },
  { kind: 'modifier', id: 'lava', icon: '🌋', name: 'Lava World', blurb: 'Three volcanoes and twice the gold. Bring marshmallows.' },
];

export class HeroHutScene extends Phaser.Scene {
  private coinsText!: Phaser.GameObjects.Text;

  constructor() {
    super('HeroHut');
  }

  create(): void {
    const w = this.scale.width;
    this.cameras.main.setBackgroundColor(0x162033);

    this.add.text(w / 2, 40, '⭐ THE HERO\'S HUT ⭐', {
      fontFamily: 'system-ui', fontSize: '34px', color: '#ffe082', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);
    this.coinsText = this.add.text(w / 2, 74, '', {
      fontFamily: 'ui-monospace, monospace', fontSize: '16px', color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(w / 2, 96, 'coins are banked whenever a run ends', {
      fontFamily: 'system-ui', fontSize: '11px', color: '#7a8595',
    }).setOrigin(0.5);

    const rows: HutRow[] = [
      ...(['whiskers', 'ember', 'bolt'] as const).map((id) => ({
        kind: 'companion' as UnlockKind,
        id,
        icon: id === 'whiskers' ? '🐱' : id === 'ember' ? '🐉' : '🤖',
        name: COMPANION_SPECS[id].name,
        blurb: COMPANION_SPECS[id].blurb,
      })),
      ...(['knight', 'ranger', 'engineer', 'miner'] as const).map((id) => ({
        kind: 'class' as UnlockKind,
        id,
        icon: CLASS_SPECS[id].icon,
        name: `${CLASS_SPECS[id].name} class`,
        blurb: CLASS_SPECS[id].blurb,
      })),
      ...MODIFIER_ROWS,
    ];

    const rowH = 46;
    const startY = 130;
    rows.forEach((row, i) => this.buildRow(row, w / 2, startY + i * rowH));

    const backY = startY + rows.length * rowH + 20;
    const back = this.add.rectangle(w / 2, backY, 180, 44, 0x26334a).setStrokeStyle(2, 0x88aaff, 0.7);
    this.add.text(w / 2, backY, '⬅  Back', {
      fontFamily: 'system-ui', fontSize: '18px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      sounds.click();
      this.scene.start('Menu');
    });

    this.refreshCoins();
  }

  private refreshCoins(): void {
    this.coinsText.setText(`you have ${MetaStore.get().coins} Star Coins`);
  }

  private buildRow(row: HutRow, cx: number, cy: number): void {
    const width = Math.min(620, this.scale.width - 40);
    const bg = this.add.rectangle(cx, cy, width, 40, 0x1a2438, 0.92).setStrokeStyle(1, 0x88aaff, 0.4);
    const name = this.add.text(cx - width / 2 + 14, cy, `${row.icon}  ${row.name}`, {
      fontFamily: 'system-ui', fontSize: '15px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(cx - width / 2 + 190, cy, row.blurb, {
      fontFamily: 'system-ui', fontSize: '11px', color: '#9eb0c4',
      wordWrap: { width: width - 320 },
    }).setOrigin(0, 0.5);

    const statusText = this.add.text(cx + width / 2 - 14, cy, '', {
      fontFamily: 'system-ui', fontSize: '13px', color: '#ffd166', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    const refresh = () => {
      if (MetaStore.isUnlocked(row.kind, row.id)) {
        statusText.setText('✓ owned');
        statusText.setColor('#9cff9c');
        bg.disableInteractive();
      } else {
        statusText.setText(`⭐ ${priceOf(row.kind, row.id)} — tap to unlock`);
        statusText.setColor(MetaStore.get().coins >= priceOf(row.kind, row.id) ? '#ffd166' : '#7a8595');
      }
    };

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      if (MetaStore.unlock(row.kind, row.id)) {
        sounds.buy();
        this.cameras.main.flash(120, 40, 60, 20);
      } else {
        sounds.click();
      }
      refresh();
      this.refreshCoins();
    });
    bg.on('pointerover', () => bg.setFillStyle(0x243250, 0.95));
    bg.on('pointerout', () => bg.setFillStyle(0x1a2438, 0.92));
    refresh();
    void name;
  }
}
