import Phaser from 'phaser';
import { HOTBAR } from './hotbarDef';

export interface HelpDeps {
  onClose: () => void;
}

export class HelpOverlay {
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, deps: HelpDeps) {
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2500);

    const w = scene.scale.width;
    const h = scene.scale.height;

    const scrim = scene.add.rectangle(0, 0, w, h, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    scrim.on('pointerdown', () => deps.onClose());
    this.container.add(scrim);

    const panelW = Math.min(w - 32, 560);
    const panelH = Math.min(h - 40, 600);
    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;
    const panel = scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x1a1c22, 0.98).setStrokeStyle(2, 0x888, 0.85);
    this.container.add(panel);

    const title = scene.add.text(w / 2, panelY + 18, 'Controls & Items', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    const closeBtn = scene.add.text(panelX + panelW - 26, panelY + 12, '✕', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#aaa',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => deps.onClose());
    this.container.add(closeBtn);

    // Scrollable content (static here — content fits).
    const contentStartY = panelY + 56;
    const controls = [
      ['WASD / joystick', 'Move'],
      ['Click / tap tile', 'Use selected hotbar item (hold to drag-build walls)'],
      ['1 – 0', 'Select hotbar slot'],
      ['Mouse wheel', 'Cycle hotbar'],
      ['E', 'Interact with shop, bench, or door'],
      ['C', 'Open crafting menu anywhere'],
      ['P', 'Drink a health potion (+40 HP)'],
      ['F', 'Eat food to heal (+20 HP)'],
      ['Shift', 'Dash — 2× speed for a short burst'],
      ['Click Rex', 'Pet the dog — he loves it'],
      ['N', 'Skip to night (day only)'],
      ['H or ?', 'Toggle this help'],
      ['Minimap', 'Bottom-right: player (white), zombies (red), shop (gold)'],
      ['Dog', 'Rex is your companion — he levels up with kills!'],
      ['Chickens', 'Hit one with sword → food drop (F to eat)'],
      ['Torch', 'Damages zombies at night in a small radius'],
      ['Campfire', 'Heal faster when standing next to it'],
      ['🎂 Cake', 'Mine it to fully heal (hidden in the world)'],
      ['☄ Meteors', 'From day 3 — red circle = danger! Drops iron/stone'],
      ['🌋 Volcano', 'From night 5 — spreads lava. Destroy with iron pick'],
      ['🩸 Blood Moon', 'Every 5th night — zombies drop 50% more loot'],
      ['⚡ Lightning', 'During rain — kills zombies near the bolt'],
      ['✨ Golden Chicken', '20% chance each day — rare! Worth 8 gold'],
      ['🌉 Bridge', 'Place on water to walk across the lake'],
    ];

    let rowY = contentStartY;
    for (const [key, desc] of controls) {
      const keyText = scene.add.text(panelX + 20, rowY, key, {
        fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#ffcc66',
      });
      const descText = scene.add.text(panelX + 160, rowY, desc, {
        fontFamily: 'system-ui', fontSize: '12px', color: '#cfd6e0',
      });
      this.container.add([keyText, descText]);
      rowY += 20;
    }

    rowY += 8;
    const divider = scene.add.rectangle(panelX + 20, rowY, panelW - 40, 1, 0x444, 1).setOrigin(0, 0);
    this.container.add(divider);
    rowY += 12;

    const itemsTitle = scene.add.text(panelX + 20, rowY, 'Items', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#fff', fontStyle: 'bold',
    });
    this.container.add(itemsTitle);
    rowY += 20;

    for (const item of HOTBAR) {
      const swatch = scene.add.rectangle(panelX + 28, rowY + 8, 14, 14, item.color).setStrokeStyle(1, 0x000, 0.5).setOrigin(0.5);
      const name = scene.add.text(panelX + 44, rowY, item.name, {
        fontFamily: 'system-ui', fontSize: '13px', color: '#fff', fontStyle: 'bold',
      });
      const desc = scene.add.text(panelX + 44, rowY + 16, item.description, {
        fontFamily: 'system-ui', fontSize: '11px', color: '#aab2c0', wordWrap: { width: panelW - 80 },
      });
      this.container.add([swatch, name, desc]);
      rowY += 16 + Math.ceil(desc.height) + 8;
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
