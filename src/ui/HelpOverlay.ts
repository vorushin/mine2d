import Phaser from 'phaser';
import { HOTBAR } from './hotbarDef';

export interface HelpDeps {
  onClose: () => void;
}

type Tab = 'controls' | 'items' | 'events';

const CONTROLS: [string, string][] = [
  ['WASD / joystick', 'Move'],
  ['Click / tap tile', 'Use selected hotbar item (hold to drag-build)'],
  ['1 – 9, 0', 'Select hotbar slot'],
  ['Mouse wheel', 'Cycle hotbar'],
  ['E', 'Interact (shop, bench, door)'],
  ['C', 'Open crafting anywhere'],
  ['Shift', 'Dash — 2× speed burst'],
  ['Click Rex', 'Pet the dog (+3 HP, hearts)'],
  ['N', 'Skip to night (day only)'],
  ['K', 'Save game (auto-saves at dawn too)'],
  ['H or ?', 'Toggle this help'],
];

const EVENTS: [string, string][] = [
  ['🐶 Rex', 'Your companion — levels up with kills'],
  ['🐔 Chickens', 'Cosmetic — wander the world'],
  ['🌉 Bridge', 'Place on water to walk across the lake'],
  ['🔥 Torch', 'Damages zombies at night in a small radius'],
  ['🏕 Campfire', 'Heal faster when you stand next to it'],
  ['🎂 Cake', 'Mine for a full heal (hidden)'],
  ['☄ Meteor', 'From day 2 — red circle = danger! Iron + stone'],
  ['🌋 Volcano', 'Grows lava each day. Break with iron pickaxe'],
  ['🩸 Blood Moon', 'Every 5th night — +50% loot'],
  ['⚡ Lightning', 'During rain — blasts zombies near the bolt'],
  ['✨ Golden Chicken', 'Rare — worth 12 gold'],
  ['🏆 Boss', 'Every 5 nights — drops massive loot + fireworks'],
];

export class HelpOverlay {
  private container: Phaser.GameObjects.Container;
  private panelX = 0;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;
  private tab: Tab = 'controls';
  private scene: Phaser.Scene;
  private contentLayer: Phaser.GameObjects.Container;
  private tabButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; tab: Tab }[] = [];

  constructor(scene: Phaser.Scene, deps: HelpDeps) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2500);
    this.contentLayer = scene.add.container(0, 0);

    const w = scene.scale.width;
    const h = scene.scale.height;

    const scrim = scene.add.rectangle(0, 0, w, h, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    scrim.on('pointerdown', () => deps.onClose());
    this.container.add(scrim);

    this.panelW = Math.min(w - 32, 560);
    this.panelH = Math.min(h - 40, 560);
    this.panelX = w / 2 - this.panelW / 2;
    this.panelY = h / 2 - this.panelH / 2;
    const panel = scene.add.rectangle(w / 2, h / 2, this.panelW, this.panelH, 0x1a1c22, 0.98).setStrokeStyle(2, 0x888, 0.85);
    panel.setInteractive();
    this.container.add(panel);

    const title = scene.add.text(w / 2, this.panelY + 14, 'Help', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    const closeBtn = scene.add.text(this.panelX + this.panelW - 26, this.panelY + 12, '✕', {
      fontFamily: 'system-ui', fontSize: '22px', color: '#aaa',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => deps.onClose());
    this.container.add(closeBtn);

    this.buildTabs();
    this.container.add(this.contentLayer);
    this.renderTab();
  }

  private buildTabs(): void {
    const tabs: Tab[] = ['controls', 'items', 'events'];
    const labels: Record<Tab, string> = { controls: 'Controls', items: 'Items', events: 'World' };
    const tabW = 120;
    const gap = 8;
    const total = tabs.length * tabW + (tabs.length - 1) * gap;
    const startX = this.panelX + this.panelW / 2 - total / 2 + tabW / 2;
    const y = this.panelY + 52;

    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      const x = startX + i * (tabW + gap);
      const rect = this.scene.add.rectangle(x, y, tabW, 30, 0x262a33, 1).setStrokeStyle(2, 0x555, 0.7);
      const label = this.scene.add.text(x, y, labels[t], {
        fontFamily: 'system-ui', fontSize: '14px', color: '#ddd', fontStyle: 'bold',
      }).setOrigin(0.5);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', () => { this.tab = t; this.updateTabStyles(); this.renderTab(); });
      this.container.add([rect, label]);
      this.tabButtons.push({ rect, label, tab: t });
    }
    this.updateTabStyles();
  }

  private updateTabStyles(): void {
    for (const b of this.tabButtons) {
      const active = b.tab === this.tab;
      b.rect.setFillStyle(active ? 0x3a4a60 : 0x262a33, 1);
      b.rect.setStrokeStyle(2, active ? 0xffd166 : 0x555, active ? 0.95 : 0.7);
      b.label.setColor(active ? '#fff' : '#bbb');
    }
  }

  private renderTab(): void {
    this.contentLayer.removeAll(true);
    const startY = this.panelY + 96;
    const rowX = this.panelX + 20;
    const data = this.tab === 'controls' ? CONTROLS : this.tab === 'events' ? EVENTS : null;

    if (data) {
      let y = startY;
      for (const [key, desc] of data) {
        const keyText = this.scene.add.text(rowX, y, key, {
          fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#ffcc66',
        });
        const descText = this.scene.add.text(rowX + 170, y, desc, {
          fontFamily: 'system-ui', fontSize: '12px', color: '#cfd6e0',
          wordWrap: { width: this.panelW - 190 },
        });
        this.contentLayer.add([keyText, descText]);
        y += Math.max(20, descText.height + 4);
      }
      return;
    }

    // Items tab: two columns of HOTBAR items
    const cols = 2;
    const colW = (this.panelW - 40) / cols;
    const startY2 = this.panelY + 96;
    for (let i = 0; i < HOTBAR.length; i++) {
      const item = HOTBAR[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = rowX + col * colW;
      const cy = startY2 + row * 52;
      const swatch = this.scene.add.rectangle(cx + 8, cy + 8, 14, 14, item.color).setStrokeStyle(1, 0x000, 0.5).setOrigin(0.5);
      const name = this.scene.add.text(cx + 22, cy, item.name, {
        fontFamily: 'system-ui', fontSize: '12px', color: '#fff', fontStyle: 'bold',
      });
      const desc = this.scene.add.text(cx + 22, cy + 16, item.description, {
        fontFamily: 'system-ui', fontSize: '10px', color: '#aab2c0', wordWrap: { width: colW - 30 },
      });
      this.contentLayer.add([swatch, name, desc]);
    }
  }

  destroy(): void {
    this.container.destroy();
    this.contentLayer.destroy();
  }
}
