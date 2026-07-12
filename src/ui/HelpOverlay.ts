import Phaser from 'phaser';
import { HOTBAR } from './hotbarDef';

export interface HelpDeps {
  onClose: () => void;
}

type Tab = 'controls' | 'items' | 'events' | 'deep';

const CONTROLS: [string, string][] = [
  ['WASD / joystick', 'Move'],
  ['Click / tap tile', 'Use selected hotbar item (hold to drag-build)'],
  ['1 – 9', 'Select active tool'],
  ['B', 'Open build picker'],
  ['Mouse wheel', 'Cycle hotbar'],
  ['E', 'Interact (shop, door, ladders, throne gate)'],
  ['C', 'Open crafting anywhere'],
  ['Shift', 'Dash — 2× speed burst'],
  ['R', 'Hero Blast when charged'],
  ['M', 'Sound on/off'],
  ['Click Rex/buddy', 'Pet your companions (+3 HP, hearts)'],
  ['Click a chicken', 'Recruit it into your chicken army (max 3)'],
  ['N', 'Skip to night (day only)'],
  ['H or ?', 'Toggle this help'],
];

const EVENTS: [string, string][] = [
  ['🗺 Campaign', '18 missions across 6 worlds — tools unlock as you go (Menu → Campaign)'],
  ['🎯 Daily Quest', 'Follow the HUD goal for bonus resources'],
  ['⚰ Graveyards', 'Each crypt adds +25% zombies at night — raid it by day!'],
  ['🏆 Bosses', 'Every 5th night: Necromancer, Spider Queen, or Stone Golem'],
  ['☠ Boss Souls', 'Bosses drop souls — 2 souls + 3 crystal = Crystal Key'],
  ['⚡ Power Orbs', 'Combo kills, quests, and bosses drop temporary powers'],
  ['🌙 Night Twists', 'Swarms, treasure, runners, fog, meteors, or frost'],
  ['👺 Goblins', 'Loot-rich raiders — some drop treasure maps (✕ marks it!)'],
  ['🐶 Companions', 'Rex bites; Whiskers digs treasure; Ember spits fire; Bolt repairs'],
  ['🐔 Chicken Army', 'Recruited chickens peck zombies. Golden ones pay 12 gold'],
  ['🎣 Fishing', 'Craft a rod, cast at the lake, tap the “!” to reel in'],
  ['❄⚡ Wands', 'Freeze Wand slows crowds; Storm Wand chains lightning'],
  ['🔥 Torch', 'Lights the dark and burns zombies in a small radius'],
  ['🏕 Campfire', 'Heal faster when you stand next to it'],
  ['🎂 Cake', 'Mine for a full heal (hidden)'],
  ['☄ Meteor', 'Red circle = danger! Drops iron + stone'],
  ['🌋 Volcano', 'Grows lava each day. Break with iron pickaxe'],
  ['🩸 Blood Moon', 'Every 5th night — +50% loot'],
  ['⭐ Star Coins', 'Every run banks coins — spend them in the Hero\'s Hut'],
];

const DEEP_DARK: [string, string][] = [
  ['🕳 Cave Entrance', 'Stand on the dark hole and press E to descend'],
  ['🪜 Ladders', 'Climb deeper (3 floors) or back toward the sky'],
  ['🌑 Darkness', 'Caves are pitch black — carry torches, place them well'],
  ['💎 Crystal', 'Floor 2+. Needs an iron pickaxe. Crafts tier-3 tools + wands'],
  ['🖤 Obsidian', 'Floor 3. Needs a crystal pickaxe. Strongest wall'],
  ['🦇 Bats', 'Fast, weave through the air, never attack walls'],
  ['🕷 Spiders', 'Lay sticky webs that slow you down'],
  ['💀 Skeleton Miners', 'Throw bones from range — break their line of sight'],
  ['📦 Treasure Vaults', 'Torch-lit rooms sealed in rock. Mine in, get rich'],
  ['👑 The Throne Room', 'Floor 3, sealed. Open it with the Crystal Key…'],
  ['🔥 The Zombie King', 'Three phases. He smashes walls when enraged. Win = credits!'],
  ['🌞 While below', 'Surface sieges pause — the horde is down there with you'],
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
    const tabs: Tab[] = ['controls', 'items', 'events', 'deep'];
    const labels: Record<Tab, string> = { controls: 'Controls', items: 'Items', events: 'World', deep: 'Deep Dark' };
    const tabW = 118;
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
    const data =
      this.tab === 'controls' ? CONTROLS :
      this.tab === 'events' ? EVENTS :
      this.tab === 'deep' ? DEEP_DARK :
      null;

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

    // Items tab: two tight columns of HOTBAR items
    const cols = 2;
    const colW = (this.panelW - 40) / cols;
    const startY2 = this.panelY + 92;
    const rowH = Math.max(34, Math.floor((this.panelH - 110) / Math.ceil(HOTBAR.length / cols)));
    for (let i = 0; i < HOTBAR.length; i++) {
      const item = HOTBAR[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = rowX + col * colW;
      const cy = startY2 + row * rowH;
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
